---
title: HyenaDNA：基因组长序列建模精读
summary: 从长卷积和门控讲起，梳理 HyenaDNA 的单核苷酸建模、长序列预训练与下游实验。
readWeek: 秋8周
cover: /papers/hyenadna/images/Pasted%20image%2020261102203542.png
tags:
  - 基因组
  - 长序列建模
  - HyenaDNA
---

# 一、研究起点

## 1.1 面临问题

#### 1.1.1 基因组语言模型

DNA序列包含基因调控、蛋白质合成等大量生物学信息，可看作由ATCG等字符组成的特殊序列，下游可利用预训练所得表征，预测调控元件、基因功能等。

但是，DNA很长，且远距离序列之间可能存在联系，如论文给出：
+ 人类基因组有 32 亿个核苷酸
+ 其中长距离依赖可能跨越 100k+ 核苷酸

#### 1.1.2 现有 Transformer 限制

1. **上下文长度有限**
	+ Self-Attention需计算序列位置间两两关系
	+ 计算复杂度 $O(L^2)$
	+ 通常使用 512~4096 核苷酸，很短
2. **单核苷酸分辨率不足**
	+ 为了处理长序列，将多核苷酸合并成一个 token
	+ 但SNP等信息可能会被忽略

### 1.1.3 HyneaDNA的目标

不仅拓宽上下文长度，还同时提高序列分辨率，即突破Transformer的两个限制

## 1.2 DNA Tokenization

采用自然 DNA vocabulary，即

$$
\mathcal V=\{A,G,C,T,N\}
$$

其中ATCG对应四种标准核苷酸，N表示非特异性核苷酸，即无法确定。**每个核苷酸对应一个token**

此外，还有padding、separation、unknown等特殊token

和 k-mer tokenizer的区别在于，k-mer每个token可以由多个碱基组成，分辨率低

## 1.3 CLM： Causal Language Modeling

截止目前，已有token序列 $X=(x_1,x_2,\ldots,x_L)$ ，其中$x_t\in\mathcal V$ ，随后，模型采用CLM来从DNA序列中学到规律

#### 1.3.1 自回归语言建模

即CLM，核心思想是 **利用前面的序列预测下一个token**

例如，假定DNA序列为

$$
X=(x_1,x_2,\ldots,x_L)
$$

单个任务即为给定前面的所有碱基，预测下一碱基的概率分布

$$
p_\theta(x_{t+1}\mid x_1,\ldots,x_t)
$$

利用概率链式法则，则整条序列的联合概率分解为

$$
p_\theta(X)= \prod_{t=1}^{L} p_\theta(x_t\mid x_{<t})
$$

即整条DNA序列的概率，可以由每个位置的条件概率相乘得到。训练时，为了提高真实下一个token的预测概率，使用负对数似然构造损失

$$
\mathcal L_{\mathrm{CLM}} = -\frac{1}{L-1} \sum_{t=1}^{L-1} \log p_\theta(x_{t+1}\mid x_{\leq t})
$$

#### 1.3.2 训练过程

![mermaid-diagram.png](/papers/hyenadna/images/mermaid-diagram.png "width=350")

其中，**Logits** 是 **模型输出的未归一化的分数**，会通过softmax归一化得到ATCG的概率。

#### 1.3.3 与MLM的区别

MLM： Masked Language Modeling
+ 即掩码语言建模，模型需要根据 Mask 位置前后上下文恢复被遮挡的碱基
+ 典型架构： Encoder-only
	+ 即双向信息交互
	+ 使用双向 Self-Attention，获得上下文token
	+ Transformer中，Encoder负责将输入序列转换为上下文表征

CLM： Causal Language Modeling
+ 典型架构： Decoder-only
	+ 即单向信息交互
	+ 使用因果注意力，只能访问当前及之前的位置
	+ Transformer中，Decoder负责根据编码结果生成目标序列

## 1.4 Figure 1.1~1.2

#### 1.4.1 Figure 1.1：整体方案

![Pasted image 20261102203542.png](/papers/hyenadna/images/Pasted%20image%2020261102203542.png)

由图可知，Hynea整体流程为：
1. DNA Sequence Length Warm-up：逐步增加训练序列的长度
2. HyenaDNA Pretraining：使用单核苷酸token和HyenaDNA Operator进行token预测
3. Adaptation to New Tasks：利用 Soft Prompt 填充上下文窗口

#### 1.4.2 上下文长度 & Perplexity

![Pasted image 20261102203824.png](/papers/hyenadna/images/Pasted%20image%2020261102203824.png "width=386")
首先，Perplexity（困惑度，PPL）衡量语言模型对真实序列的预测能力，定义为

$$
\operatorname{PPL} = \exp\left( -\frac{1}{L} \sum_{t=1}^{L} \log p_\theta(x_t\mid x_{<t}) \right)
$$

可见预测越准，PPL越低。

如图所示，随着序列长度的增加，总体PPL稳步下降，说明模型利用更长上下文后，对下一核苷酸预测有所改善。

# 二、从卷积到 Hyena

## 2.2 离散卷积：从局部计算到全局信息交互

#### 2.2.1 一维卷积

假设输入序列和卷积核为：

$$
x=[2,3,5,7] \quad h=[1,2,1]
$$

则计算过程：
![Pasted image 20261102210048.png](/papers/hyenadna/images/Pasted%20image%2020261102210048.png)

#### 2.2.2 长卷积

示例一维卷积核长度为 3，将卷积核长度扩展到 $L$ 则每个输出位置可接受整个序列的信息，称作 **长卷积** Long Convolution，表达式为

$$
y_t=(h*x)_t =\sum_{t'=0}^{L-1}h_{t-t'}x_{t'}
$$

对于 HyenaDNA 的CLM，t 汇总了当前及之前的信息。随后，论文将卷积写成

$$
y=T_hx \quad T_h\in\mathbb R^{L\times L}
$$

$T_h$即为 Toeplitz 矩阵，特点为 **从左上到右下的对角线元素相同**，以长度为4的因果卷积和卷积矩阵为例：

$$
x= \begin{bmatrix} x_0\\x_1\\x_2\\x_3 \end{bmatrix} \quad T_h= \begin{bmatrix} h_0&0&0&0\\ h_1&h_0&0&0\\ h_2&h_1&h_0&0\\ h_3&h_2&h_1&h_0 \end{bmatrix}
$$

得：

$$
\begin{bmatrix} y_0\\y_1\\y_2\\y_3 \end{bmatrix} = \begin{bmatrix} h_0&0&0&0\\ h_1&h_0&0&0\\ h_2&h_1&h_0&0\\ h_3&h_2&h_1&h_0 \end{bmatrix} \begin{bmatrix} x_0\\x_1\\x_2\\x_3 \end{bmatrix}
$$

此为因果长卷积的全局信息交互方式，让**每个输出位置都能汇总它之前的全部输入信息**

然而，直接计算长卷积，乘法次数以此为 $1,2,3,\ldots,L$ ，求和得到

$$
N(L)=\frac{L(L+1)}{2}
$$

故复杂度为 $O(L^2)$，为了加快卷积，引入 **FFT**

## 2.3 FFT： Fast Fourier Transform

即快速傅里叶变换，通过快速计算离散傅里叶变换，将序列从时域转换到频域，关键性质为 “**时域中的卷积**，**对应频域中的逐元素乘法**”

#### 2.3.1 时域 & 频域

+ 时域
	+ 描述信号随位置变换的数值
	+ 如 $x=[2,3,5,7]$
+ 频域
	+ 从不同频率成分表示该序列
	+ 如对于 x，离散傅里叶变换可写为 

$$
X_k=\sum_{n=0}^{N-1} x_n e^{-i2\pi kn/N}
$$

	+ 其中：$x_n$时域是第 $n$ 个位置的数值 ；$X_k$ 是频域第 $k$ 个频率分量

#### 2.3.2 卷积定理

设 $y=h*x$ ，卷积定理给出

$$
\mathcal F(y) = \mathcal F(h)\odot\mathcal F(x)
$$

其中：
- $\mathcal F$：傅里叶变换
- $\odot$：逐元素乘法

因此，可将卷积计算拆成三步骤：
1. **FFT**：将输入序列和卷积核，从时域转到频域 $O(LlogL)$

$$
X=FFT(x) \quad H=FFT(h)
$$

2. **逐元素相乘**：在频域完成卷积对应乘法 $O(L)$

$$
Y=H\odot X
$$

3. **逆FFT**：转换回时域，得到卷积结果 $O(LlogL)$

$$
y=IFFT(Y)
$$

故，该算法的复杂度为 $O(LlogL)$，小于长卷积的 $O(L^2)$

## 2.4 长卷积和 Self-Attention 的区别

自注意力，通过计算 Query-Key 两两相似度，复杂度为 $O(L^2)$

$$
Y=Softmax(\frac{QK^\top}{\sqrt{D}})V
$$

不过，最明显的区别在于：
+ Self-Attention
	+ 通过 $q_i^\top k_j$ 计算位置 i 和 j 的交互权重
	+ 值由两位置特征共同决定
+ 长卷积
	+ 通过 $T_{ij}=h_{i-j}$ 得到卷积核，交互权重由相对距离决定
	+ 同样的相对距离共享卷积核权重，如 $T_{1,0}=T_{2,1}=T_{3,2}=h_1$

但，如果卷积核的权重只取决于相对位置，那么模型如何根据 DNA 序列调整信息交互？

Hyena说：在长卷积两侧加入**输入控制的门控**，并使用神经网络隐式生成卷积核

# 三、Hyena 算子 & Block

## 3.1 门控的必要性

长卷积，由上文可知，**相同相对距离使用相同的卷积核权重**，也因此，对于两条不同的DNA序列，卷积核的相对位置权重固定，**没有根据输入序列内容动态调整权重**

为了让模型能做到，**针对性让不同输入序列产生不同信息调节方式**，让某些输入特征经过长距离信息混合后得到**增强或抑制**

因此，作者引入 **门控**：一种通过逐元素乘法调节特征的机制。例如，给定特征向量 $v$ 和门控值 $g$

$$
v=[2,3,4,5] \quad g=[1,0.2,0.5,0]
$$

通过逐元素乘法 $\odot$  得到

$$
g\odot v = [2,0.6,2,0]
$$

因此，通过**门控**，模型可以**决定输入的特征以多大服务参与运算**，而**长卷积核决定不同相对距离如何进行信息混合**。两者结合，让长卷积具有输入依赖性

## 3.2 Hyena 算子

#### 3.2.1 投影结果

首先，模型接受输入序列

$$
x\in\mathbb R^L
$$

并通过线性层和短卷积，产生三个序列

$$
x_1,x_2,v\in\mathbb R^L
$$

三者来自同一份输入，但经过不同的投影
+ $x_1$：长卷积前门控值
+ $x_2$：长卷积后门控值
+ $v$：进行长卷积的序列

#### 3.2.2 对角矩阵

论文定义由 $x_1, x_2$ 构造的对角矩阵

$$
D_{x_1}=diag\{x_1\},D_{x_2}=diag\{x_2\}\quad D_{x_1}, D_{x_2}\in\mathbb R^{L\times L}
$$

由此，对角矩阵和向量相乘，恰好实现逐元素乘法

$$
D_{x_1}v=x_1\odot v
$$

例如

$$
D_{x_1}v = \begin{bmatrix} 2&0&0\\ 0&3&0\\ 0&0&4 \end{bmatrix} \begin{bmatrix} 5\\6\\7 \end{bmatrix} = \begin{bmatrix} 10\\18\\28 \end{bmatrix}
$$

#### 3.2.3 完整公式

论文给出：

$$
H(x_1,x_2)v=D_{x_2}T_hD_{x_1}v
$$

从右向左计算，则计算顺序为：
1. **第一次门控**：$u_1=D_{x_1}v$
	+ 可调节哪些**输入特征**参与长距离信息混合
2. **长卷积**：$u_2=T_hu_1$
3. **第二次门控**：$y=D_{x_2}u_2$
	+ 可调节长卷积聚合后的**输出特征**

$$
(x_1,x_2,v)\longmapsto H(x_1,x_2)v
$$

![Pasted image 20261103134812.png](/papers/hyenadna/images/Pasted%20image%2020261103134812.png "width=437")
## 3.3 Figure 3：Hyena完整网络
![Pasted image 20261103121622.png](/papers/hyenadna/images/Pasted%20image%2020261103121622.png)
#### 3.3.1 隐式参数化：生成卷积核权重

作者使用小型神经网络 $\gamma_\theta$ ，根据位置索引 $t$ 生成卷积核的值。论文给出：

$$
h_t=\gamma_\theta(t)
$$

相比于直接参数化，隐式参数化可以在卷积核长度增加时，仅需多调用 $\gamma_\theta$，而不是增加对应卷积核参数

如图右侧，先通过位置编码，然后经历线性层+正弦激活函数，最后生成卷积核参数

$$
\text{Position} \rightarrow \text{MLP} \rightarrow h_t
$$

#### 3.3.2 Hyena Order-N

如图中间所示，包含：
+ Dense + Conv：从输入生成不同投影
+ Elem-wise Gate：逐元素门控
+ Long Convolution：长卷积

Order-N里，模型对输入进行交替的门控和长卷积，构造高阶的Hyena算子，即 **Hyena Operator**

其中，N为输入+输出门控总次数，长卷积次数为 N-1 

#### 3.3.3 完整 HyenaDNA Block

如图左侧显示，该block由两部分组成
+ Hyena Operator
+ Feed-forward MLP

并附有残差链接，保留原始输入信息。

最后，多个Block堆叠，得到 **HyenaDNA backbone**

# 四、训练与适配

## 4.1 完整预训练流程

#### 4.1.1 数据与任务

作者使用人类参考基因组进行预训练，目标是预测下一个核苷酸。在预测时，会通过 Language Model Head 预测出核苷酸概率，并计算CLM Loss。假设隐藏维度为 $D$，已知词表维度为 12：
+ 五种核苷酸 token： ATCGN
+ 三种特殊 token： PAD（Padding，填充）、SEP（Separation，分割）、UNK（Unknown，未知）

得到嵌入矩阵：

$$
E\in\mathbb R^{8\times D}
$$

#### 4.1.2 数据流
1. 输入 DNA 序列： ATCGN
2. 映射到**Single-character Tokenization**：如[0,1,2,3,4]
3. 通过**嵌入矩阵**来编码，得：$B\times L\times D$
4. 经过 **HyenaDNA Backbone**：即上文的 Operator 和 前向网络
5. 得到**隐藏向量**：$H\in\mathbb R^{B\times L\times D}$
6. 经过**Language Model Head**： $Z=HW_{\mathrm{LM}}$ ，其中 $Z\in\mathbb R^{B\times L\times 8}$
7. Softmax 归一化，得概率分布：$p_\theta(\cdot\mid x_{\leq t}) = \operatorname{Softmax}(Z_t)$

训练损失为标准的CLM交叉熵，为

$$
\mathcal L_{\mathrm{CLM}} = -\frac{1}{L-1} \sum_{t=1}^{L-1} \log p_\theta(x_{t+1}\mid x_{\leq t})
$$

## 4.2 Sequence Length Warm-up

作者观察到，直接使用超长序列训练，会导致梯度方差增加，降低稳定性，故采用 **逐步增加训练序列长度** 的策略：
+ 初始序列长度： $L_1 = 64$
+ 每个阶段扩大一倍
+ Batch size 不变

结果如图所示，在预热之后，模型能在更短时间内，达到更高的准确度
![Pasted image 20261103134854.png](/papers/hyenadna/images/Pasted%20image%2020261103134854.png "width=313")

## 4.3 下游任务适配

预训练后，hyenaDNA已经学到了DNA序列的表征，接下来要讲这些表征用于具体任务，如分类和功能预测

#### 4.3.1 Fine-tuning

**全模型微调**，即在预训练参数基础上，继续使用下游任务数据更新模型，以分类为例，数据流大致如下：

$$
X\rightarrow\text{HyenaDNA}\rightarrow H \rightarrow\text{Classification Head} \rightarrow\hat y
$$

训练过程中，不仅更新 Classification Head 参数，还更新 HyenaDNA Backbone 参数

#### 4.3.2 Frozen Feature Extraction

冻结特征提取，即 **冻结预训练 HyenaDNA ， 只利用其提取特征，再单独训练下游分类器**，数据流与 Fine-tuning 类似，但是不能更新 HyenaDNA的参数

#### 4.3.3 Soft Prompting

**可训练提示向量**，基本思想是 **在原始序列embedding中拼接可训练向量**，如公式：

$$
x\leftarrow \operatorname{concat} [\operatorname{embed}(x_p),\theta]
$$

其中，$x_p$ 为下游任务的输入序列，$\theta$ 为Soft Prompt，数据流为

$$
X+\theta\rightarrow \text{HyenaDNA}\rightarrow \hat y
$$

依旧不改变 HyenaDNA 参数，只改变 $\theta$

# 五、实验过程

## 5.1 GenomicBenchmarks

作者使用 GenomicBenchmarks 评估模型对短DNA的分类能力，研究对象为基因组的调控元件，如增强子、启动子等

数据集为调控元件分类数据集，提供调控元件的类别标签，而模型会输出每条序列对应的类别预测

在该实验中，作者采用 Top-1 Accuracy（最高概率类别准确率），相对于CNN、DNABERT、GPT取得了优越成绩，说明了 **HyenaDNA但核苷酸分辨率模型能有效分类DNA短序列**

## 5.2 Nucleotide Transformer Benchmark

作者进一步使用 Nucleotide Transformer 论文的18个基因组进行比较，任务包括：
+ 增强子预测：MCC
+ 启动子预测：F1
+ 表观遗传标记预测：MCC
+ 剪接位点预测：F1

其中，作者使用2类指标
+ **MCC**（马修斯相关系数）
	+ 用于二分类预测，适合类别比例不均衡的二分类任务
	+ 取值 [-1, 1]
		+ 1则完全正确
		+ -1则完全相反

$$
\mathrm{MCC} = \frac{TP\cdot TN-FP\cdot FN} {\sqrt{(TP+FP)(TP+FN)(TN+FP)(TN+FN)}}
$$

+ **F1-score**
	+ 是 Precision 和 Recall 的调和平均
	+ 越高，则两者综合表现越好

$$
F1= 2\frac{Precision\cdot Recall} {Precision+Recall}
$$

在和 NT 比较时，Hyena 参数量和预训练基因组更少，但大部分数据集优于 NT

## 5.3 Soft Prompting

作者仍然使用 GenomicBenchmarks 的数据集，选取 160k 的序列进行预训练，soft promot长度设置为 2-32k，下为结果图，其中横轴即为 Soft Prompt

![Pasted image 20261103174226.png](/papers/hyenadna/images/Pasted%20image%2020261103174226.png)

由图可知，在五个数据集上，增加 Soft Prompt token数量，模型表现总体改善，也说明了，再冻结 HyenaDNA 的情况，可通过此方式改善模型在分类任务的表现

## 5.4 Chromatin Profile Prediction

作者使用 DeepSEA 数据集预测DNA序列对应的染色质特征，模型需要预测一条DNA序列对应的多个染色质标签，研究对象包括：
- TF：Transcription Factor Binding Profiles，转录因子结合特征
- DHS：DNase I-hypersensitive Sites，DNase I 超敏感位点
- HM：Histone Marks，组蛋白修饰标记

总共 919 个标签

作者希望模型利用中心区域两侧序列信息，预测中心区域的染色质特征，故输入包含中心区域及其 flanking regions，即侧翼序列，并输出

$$
\hat y\in\mathbb R^{919}
$$

最后，作者用 AUROC 来衡量模型区分正负样本的能力，最后实验结果也很好

## 5.5 Biotype Embeddings

Biotype，是指 Ensembl 数据库中基因类型注释，用于描述基因所属类别，如
+ Protein coding：蛋白编码
+ lncRNA
+ miRNA
+ Processed pseudogene：加工型假基因

等注释，作为分类标签

预训练完成后，作者想了解**模型提取的 DNA 序列 Embedding ，是否包含于基因生物学功能有关的信息**

因此，作者开展以下实验：

| 项目   | 实验设置                                    |
| ---- | --------------------------------------- |
| 数据来源 | Ensembl                                 |
| 研究对象 | 人类基因序列                                  |
| 标签   | 基因 Biotype                              |
| 比较模型 | DNABERT、Nucleotide Transformer、HyenaDNA |
| 分类类别 | 出现频率最高的 10 种 Biotype                    |
| 分类器  | XGBoost                                 |

步骤如下：
1. **输入序列**
2. **提取 Embedding**
	+ 不同模型上下文长度不同
	+ 若上下文爆了，则拆成多个片段，分别编码，并对Embedding取平均
3. **XGBoost 分类**
	+ 一种基于梯度提升决策树的分类算法
	+ Embedding输入后，预测对应 biotype
4. **t-SNE 可视化**

![Pasted image 20261103182649.png](/papers/hyenadna/images/Pasted%20image%2020261103182649.png)

如图，每个点代表一个基因 Embedding ，颜色代表注释。由图可知，HyenaDNA的embedding形成较明显聚类，说明模型提取的序列表示包含与biotype有关的信息

随后，作者计算加权F1-score，发现Hyena依旧更好，且参数量更小
