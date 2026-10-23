---
title: scVI：单细胞生成模型精读
summary: 从 count 数据的概率建模出发，梳理 scVI 的生成模型、潜空间和差异表达分析。
readWeek: 秋6周
cover: /papers/scvi/cover.png
tags:
  - 单细胞
  - 变分推断
  - 生成模型
---

# 一、导览：为什么提出scVI

### 1.1 待解决的问题

scRNA-seq能识别细胞间的生物学差异，但数据容易受到测序深度等影响。
作者认为，现有方法存在三个问题：
+ 广义线性模型描述潜在结构不够灵活
+ 不同分析任务使用不同模型
+ 难以处理大量细胞
**核心研究问题**：能否建立一个可扩展的概率模型，同时考虑数据中的技术变异和生物学差异，并让统一模型支持多种下游分析

### 1.2 解决方案

![Pasted image 20261019142647.png](/papers/scvi/images/Pasted%20image%2020261019142647.png)

+ 对于普通VAE，常是高维输入映射到低维latent space，再从中重建数据。
+ scVI延续并改进，为单细胞 count 数据指定了**概率生成模型**，并考虑文库大小和批次效应
	+ scVI采用零膨胀负二项分布，即ZINB，以预测整个分布
因此，scVI不仅输出用于聚类和可视化的低维表示，又可以输出可用于表达分析的概率分布参数。

### 1.3 如何证明scVI有用

+ **Fig1**：模型能运行，规模能扩大
	+ a：模型架构
	+ b：比较不同方法随细胞数量增加所需的训练时间
	![Pasted image 20261019143553.png](/papers/scvi/images/Pasted%20image%2020261019143553.png)

+ **Fig2**：latent space有保留生物学信息
	+ 使用三个数据集，比较细胞间结构和批次矫正效果
	![Pasted image 20261019143929.png](/papers/scvi/images/Pasted%20image%2020261019143929.png)

+ **Fig3**：模型能准确识别差异表达基因，服务实际生物学分析
	+ 使用多个PBMC，对比不同方法，并以bulk表达分析结果为参照
	![Pasted image 20261019144048.png](/papers/scvi/images/Pasted%20image%2020261019144048.png)


### 1.4 从Discussion得到什么结论

作者认为：
+ 统一的概率模型可同时提供低维表达表示和多种下游分析能力
+ 将细胞特异性的library size和batch annotation纳入模型，能带来显著受益
	+ library size：即细胞测量的总计数规模，即该细胞的所有基因count相加，记为$L_n$
		+ 不过实际计算时，用的是特异性缩放因子$l_n$
	+ batch annotation：即记录每个细胞来自哪个实验批次的标签，让模型显式考虑批次差异，记为$s_n$
但是，细胞数少于基因数的话，scVI可能会欠拟合

综上，该论文需要回答三个相互关联的问题：
+ scVI的概率建模为什么适合单细胞count？
+ 为什么该建模方式有助于保留生物学结构，并处理技术差异？
+ 实验结果如何证明上述两点

# 二、从count来看，为什么要这样建模

### 2.1 研究&观测对象

作者指出，sc RNA-seq 受到三个因素影响：
+ **检测灵敏度**：有限且存在差异
	+ 检测灵敏度：能成功检测到多少RNA分子
	+ 有限：即捕获概率低，容易出现0值
		+ 因此0不代表基因未表达
	+ 存在差异：不同情况下RNA捕获效率不同
+ **批次效应**
+ **转录噪声**
	+ 由基因表达过程的随机性造成，毕竟基因有时活跃有时不活跃
这导致我们所观测到的细胞差异，未必全部来自真实生物学差异

### 2.2 原有方法的局限性

+ **低维表达结构建模不够灵活**
	+ 假设高维表达数据与低维潜在结构可以用**广义线性模型**（**GLM**）表示
	+ 但真是细胞表达模式可能包含复杂非线性关系，排除
+ **不同下游任务**，**模型也不同**
	+ 问题：不同任务队同一数据，统计假设可能不一致
	+ 因此构建统一的分布模型，让下游任务共享同一概率描述
+ **已有方法难以处理更大数据**
### 2.3 scVI所需能力

| 问题              | 要求            | scVI                               |
| --------------- | ------------- | ---------------------------------- |
| count 具随机性和大量零值 | 描述观测数据的概率分布   | 概率生成模型                             |
| 细胞间存在技术变异       | 显式考虑计数规模和批次信息 | library size 潜变量与 batch annotation |
| 生物学关系复杂         | 学习灵活的低维表示     | 非线性神经网络                            |
| 分析任务使用不同统计模型    | 尽可能共享一个概率描述   | 统一生成模型支持多个下游任务                     |
| 细胞数量很大          | 降低训练的内存和计算负担  | 随机优化和 mini-batch 训练                |

# 三、Fig1a
![Pasted image 20261020150240.png](/papers/scvi/images/Pasted%20image%2020261020150240.png)
+ 输入
	+ 橙色：第n个细胞的count矩阵
		+ $x_n = (x_{n,1}, ... ,x_{n,G})$
	+ 绿色：所属batch
		+ 记为 $s_n$
+ 左侧：类似Encoder
+ 右侧：类似Decoder
### Encoder

![Pasted image 20261020150636.png](/papers/scvi/images/Pasted%20image%2020261020150636.png)

+ NN1、NN2：推断细胞的**缩放因子标量** $q( \mathbf l_n \mid x_n, s_n$
	+ 由于一个细胞总UMI并非真实总UMI，故引入 **细胞特异性缩放因子** $l_n$ 来描述细胞umi规模
		+ $L_n$是数据直接求和而来
		+ $l_n$是预测所得的潜变量
	+ NN1：均值参数
	+ NN2：标准差参数
+ NN3、NN4：推断细胞的**低维表示向量** $q( \mathbf z_n \mid x_n, s_n)$
	+ NN3：均值向量
	+ NN4：标准差向量
	+ 原论文里，$\mathbf z_n = (z_{n1}, ..., z_{n10})$，并希望$z_n$可以反映生物学差异，适合后续的可视化和聚类
+ Sampling
	+ AE：x经encoder得确定的z
	+ scVI： $x, s$经encoder得均值和标准差，并在分布中采样得到$z, l$
	+ 综上，变分后验可理解为：根据 $x, s$，推断 $z, l$会取哪些值，以及这些值的不确定性
### Decoder
![Pasted image 20261020152008.png](/papers/scvi/images/Pasted%20image%2020261020152008.png)

+ NN5：输出细胞n里各基因的**期望表达频率** $\rho_n = f_w(z_n, s_n) = (\rho_{n1}, ... ,\rho_{nG})$
	+ 使用softmax归一化，确保 $\rho_n = 1$
	+ 与缩放因子 $l_n$ 相乘，得到预期count $\mu_{ng} = l_n \rho_{ng}$
+ NN6：输出细胞n里各基因的**额外零膨胀概率参数** $\boldsymbol{\pi}_n=f_h(\mathbf z_n,s_n)$
	+ 又称 **额外零概率**
	+ 未归一化，有$\pi_{ng}$的概率直接取0；有$1-\pi_{ng}$的概率从NB中取样
# 四、如何从潜变量生成观测count分布
### 4.1 选择合适的离散概率分布——NB

已知scRNA-seq是count矩阵，且存在过度离散，即数据的方差大于均值，所以泊松分布不适用（均值=方差），而是使用**负二项分布** Negative Binomial **NB**

$$X\sim\operatorname{NB}(\mu,\theta)$$
其中，$\mu$为NB的均值，$\theta$为逆离散度参数。X的均值和方差为：
$$\boxed{ \begin{aligned} \mathbb E[X]&=\mu\\ \operatorname{Var}(X)&=\mu+\frac{\mu^2}{\theta} \end{aligned}}$$
也因此，相比于泊松分布，**负二项分布可以在 $\mu$ 不变时，调节方差**

### 4.2 引入额外零值的NB——ZINB

即引入伯努利随机选择
+ 有 $\pi$ 的概率直接输出0
+ 有 $1-\pi$ 的概率从NB采样，也有可能采样得到0
$$P(X=k)= \begin{cases} \pi+(1-\pi)P_{\mathrm{NB}}(0),&k=0\\ (1-\pi)P_{\mathrm{NB}}(k),&k>0 \end{cases}$$
### 4.3 带入scVI

1. 预测得到以下参数

| 参数          | 从哪里来       | 代表什么         |
| :---------- | :--------- | :----------- |
| $\rho_{ng}$ | NN5        | 该基因的预期相对表达频率 |
| $\ell_n$    | NN1        | 整体计数规模       |
| $\theta_g$  | 单独估计，按基因共享 | NB 的逆离散度     |
| $\pi_{ng}$  | NN6        | 额外零值机制的概率    |

2. 得到 NB 均值参数
$$\boxed{\mu_{ng}=\ell_n\rho_{ng}}$$
3. 确认 ZINB
$$\boxed{ X_{ng}\mid\mathbf z_n,\ell_n,s_n \sim \operatorname{ZINB}(\mu_{ng},\theta_g,\pi_{ng}) }$$
4. 得到单个细胞单个基因count的完整公式
$$\boxed{ p(x_{ng}=k\mid\mathbf z_n,\ell_n,s_n) = \begin{cases} \pi_{ng}+(1-\pi_{ng})P_{\rm NB}(0), &k=0\\[4pt] (1-\pi_{ng})P_{\rm NB}(k), &k>0 \end{cases} }$$
5. 单基因推广到整个细胞
$$\boxed{ p(\mathbf x_n\mid\mathbf z_n,\ell_n,s_n) = \prod_{g=1}^{G} p(x_{ng}\mid\mathbf z_n,\ell_n,s_n) }$$

# 五、潜变量如何推断并训练

### 5.1 基于VAE

$$\underbrace{q_\phi(z\mid x)}_{\text{Encoder：近似后验}} \qquad \underbrace{p_\psi(x\mid z)}_{\text{Decoder：生成分布}}$$
### 5.2 同时推断 $z_n, \ell_n$ 

根据 **mean-field 假设**：

$$\boxed{ q_\phi(\mathbf z_n,\ell_n\mid\mathbf x_n,s_n) = q_\phi(\mathbf z_n\mid\mathbf x_n,s_n) q_\phi(\ell_n\mid\mathbf x_n,s_n) }$$

scVI对两者使用不同先验，并分别正则化：
$$\boxed{p(\mathbf z_n)=\mathcal N(\mathbf 0,\mathbf I)}$$
$$\boxed{ p(\ell_n\mid s_n) =\operatorname{LogNormal}(\text{批次相关参数}) }$$
可见 $l_n$ 为正，且不同批次的 $l_n$ 有不同分布参数

### 5.3 ELBO

$$\boxed{ \begin{aligned} \mathcal L_n ={}& \underbrace{ \mathbb E_{q_\phi} [\log p_\psi(\mathbf x_n\mid\mathbf z_n,\ell_n,s_n)] }_{\text{① ZINB 重建项}} \\[4pt] &- \underbrace{ D_{\mathrm{KL}}[ q_\phi(\mathbf z_n\mid\mathbf x_n,s_n) \|p(\mathbf z_n)] }_{\text{② 潜在表示的 KL}} \\[4pt] &- \underbrace{ D_{\mathrm{KL}}[ q_\phi(\ell_n\mid\mathbf x_n,s_n) \|p(\ell_n\mid s_n)] }_{\text{③ 缩放因子的 KL}} \end{aligned} }$$
其中，
+ $p_\psi$ 表示由生成网络参数化的观测分布
+ $q_\phi$ 表示 Encoder 的近似后验
三项有各自的职责
+ ZINB重建项：让模型给真实count分配尽可能高的概率
+ $z_n$ 的 KL：约束细胞潜在表示近似后验，不要太偏离标准正态先验
+ $\ell_n$ 的 KL：约束缩放因子近似后验，与批次相关先验保持合理关系

# 六、scVI 拟合效果

### 6.1 Fig1b：百万细胞运行时间

![Pasted image 20261020165851.png](/papers/scvi/images/Pasted%20image%2020261020165851.png)
+ 横轴：数据规模
+ 纵轴：运行时间
由此可见：
1. 很多方法难以在100万个细胞上进行
2. scVI 和 DCA 扩展性好
3. 早停 Early Stopping 对百万细胞训练影响大，橙色的可以在一小时内完成训练
### 6.2 人工损坏和插补实验

![Pasted image 20261020170308.png](/papers/scvi/images/Pasted%20image%2020261020170308.png)

仅有两种损坏方式：
+ 非零 → 人为置零：模拟观测缺失数据
+ 抽取count一部分：模拟计数检测不足
插补时，scVI使用 NB 的均值，而非ZINB的均值
+ 采用 ZINB 的多个模型表现较好，优于其他分布的
+ 在HEMATO数据集上，MAGIC表现优于scVI
	+ 可能是因为基因数大于细胞数时，scVI 欠拟合

### 6.3 留出对数似然实验

![Pasted image 20261020171306.png](/papers/scvi/images/Pasted%20image%2020261020171306.png)
大致就是让测试集经encoder，采样后经decoder得到ZINB的参数，最后计算原始count在该ZINB的出现概率

评价的是模型对新数据的概率拟合能力

# 七、Fig2：潜空间是否保留了生物学信息

### 7.1 前置知识

#### 数据集

scVI 使用三个不同生物学特征的数据集作为测试：

| 数据集                | 细胞数量   | 核心检验                 |
| ------------------ | ------ | -------------------- |
| CORTEX（小鼠大脑皮层）     | 3,005  | 能否区分不同细胞类型，并保留层次关系？  |
| HEMATO（造血祖细胞）      | 4,016  | 能否保留连续（而非离散簇）分化过程？   |
| RETINA（小鼠视网膜双极神经元） | 27,499 | 能否消除批次差异，同时保留不同细胞亚群？ |
并且，三者还有很强的递进关系
![Pasted image 20261020172224.png](/papers/scvi/images/Pasted%20image%2020261020172224.png)

#### 潜空间评判标准

1. **区分细胞类型**
2. **保留生物学关系**：即相近细胞类型之间的举例，可反映相似关系，应该保留连续分化状态
3. **减弱批次效应**

### 7.2 CORTEX：区分细胞类型，并保留层次结构
![Pasted image 20261020172716.png](/papers/scvi/images/Pasted%20image%2020261020172716.png "width=368")
#### 右侧：t-SNE可视化

+ SIMLR：相对紧凑，分离明显
+ scVI：相对分散，部分混合
#### 左侧：细胞间距离矩阵

即潜空间里两个细胞之间的欧氏距离，数值表示细胞之间的相似性程度，数值越低表示相似性越高。
+ SIMLR：清晰的深色对角块，可见善于构建紧凑的细胞群
+ scVI：有大范围的距离层次变化

说明scVI不仅能**把细胞分开**，还**保留了细胞亚群的层次关系**

### 7.3 HEMATO：潜空间能否保留连续分化过程

![Pasted image 20261020174500.png](/papers/scvi/images/Pasted%20image%2020261020174500.png "width=448")
HEMATO 包含造血细胞，而造血细胞状态可以逐渐发生改变，即**连续分化**

#### 右侧：力导向图

+ SIMLR：多条细长分支，部分细胞相对分离
+ scVI：细胞形成连续的整体，展示了细胞状态的连续变化过程

#### 左侧：距离矩阵

+ SIMLR：明显的块状结构
	+ 擅长离散聚类
+ scVI：相对不那么明显
	+ 擅长连续分化

### 7.4 RETINA：能否处理批次效应？

![Pasted image 20261020180048.png](/papers/scvi/images/Pasted%20image%2020261020180048.png "width=452")
#### 左侧：按 Batch 着色

+ MNNs + PCA：十分明显，绿色与蓝色有明显分离
+ scVI：蓝绿色均匀混合
由此可见，scVI减弱了批次效应，让不同批次的细胞能混合

#### 右侧：按细胞类型着色

明显看出，scVI在实现batch混合的前提下，能让各个细胞亚群仍相对独立。

由此可见，**scVI在减弱批次效应的同时，也能区分细胞亚群**

如果要量化的话，可以引入 **批次混合熵**：抽取一个细胞，统计50个最近邻来自哪些 batch，并计算比例的熵。对随机抽取的若干细胞取平均
$$\boxed{ H=-p_A\ln p_A-p_B\ln p_B }$$
熵越大，则细胞混合越充分

### 7.5 scVI 潜空间的优势

#### 生物学一致性

CBMC数据中，作者比较 **RNA潜空间的细胞相似性** 和 **蛋白质表达定义的细胞相似性**，发现结果比较一致

说明，模型从RNA学到的细胞相似性，与真实的蛋白质数据一致，具有生物学意义
#### 避免虚假聚类

作者用从 ZINB 分布随机采样的噪声数据来测试
+ SIMLR 识别出虚假的细胞簇
+ scVI 等其他方法没有

# 八、scVI如何进行表达差异分析

### 8.1 表达差异 DE

假设我们比较不同细胞中某个基因的表达
+ 传统方法：利用两组细胞的count、归一化树脂、统计模型来检验差异
+ scVI：利用预测的相对表达频率 $\rho_{ng}$，并将两组细胞转换为两个假设
$$\begin{aligned} H_1^g &: \rho_{ag} > \rho_{bg} \\ H_2^g &: \rho_{ag} \leq \rho_{bg}  \end{aligned}$$
并找到一个数字来衡量，观测结果支持 $H_1^g$ 还是 $H_2^g$ ？

### 8.2 Bayes factor

假设有数据集 $D$ 和相互竞争的 $H_1^g$ 和 $H_2^g$ ，若
$$P(D\mid H_1)=0.8,\qquad P(D\mid H_2)=0.2$$
 则很明显，D更支持$H_1$。**贝叶斯因子** **BF** 则衡量$D$对两个$H$的相对支持程度的统计量
$$\boxed{ BF_{12} = \frac{p(D\mid H_1)} {p(D\mid H_2)} }$$
其与先验概率和后验概率的关系为：
$$\boxed{ \underbrace{ \frac{P(H_1\mid D)}{P(H_2\mid D)} }_{\text{后验赔率}} = \underbrace{BF_{12}}_{\text{贝叶斯因子}} \times \underbrace{ \frac{P(H_1)}{P(H_2)} }_{\text{先验赔率}} }$$
+ BF 表示数据本身提供的相对证据
+ 若两假设先验概率相等，则后验赔率即为 $BF_{12}$，论文后续就是如此

论文中，真正取的是 **后验对数赔率**
$$K_g=\log BF_{12}$$
- $K_g>0$：支持 $H_1$
- $K_g<0$：支持 $H_2$
- $K_g=0$：两者支持程度相同
- $|K_g|>3$：达到强证据阈值

### 8.3 scVI 如何分析A、B两组细胞的表达差异？

#### 1. 从2个细胞中获得潜变量后验

假设
$$a\in A,\qquad b\in B$$
利用训练好的 Encoder，可得：
$$\begin{aligned} q_\phi(\mathbf z_a\mid\mathbf x_a,s_a)\\ q_\phi(\mathbf z_b\mid\mathbf x_b,s_b) \end{aligned}$$
#### 2. NN5预测相对表达频率

分别从潜变量分布采样，得到
$$\mathbf z_a^{(1)},\qquad \mathbf z_b^{(1)}$$
随后对所有批次的该细胞进行加权求和
$$\boxed{ r_g(\mathbf z^{(1)}) = \sum_{s}P(s)f_w^g(\mathbf z,s)}
$$
+ $f_w^g(\mathbf z,s)$是相对表达频率
+ $P(s)$是数据中 batch s 所占比例

#### 3. 判断单次采样支持哪个比例

若 $$r_g(\mathbf z_a^{(1)}) > r_g(\mathbf z_b^{(1)})$$
则该次采样，支持$H_1$，反之亦然

#### 4. 重复采样，估计概率

![Pasted image 20261020203718.png](/papers/scvi/images/Pasted%20image%2020261020203718.png)
假设 200 次采样中有 196 次支持 \(H_1\)，4 次支持 \(H_2\)。

那么：

$$P(H_1^g\mid\mathbf x_a,\mathbf x_b) \approx\frac{196}{200}=0.98$$

$$P(H_2^g\mid\mathbf x_a,\mathbf x_b) \approx\frac4{200}=0.02$$

于是：

$$\boxed{ K_g=\ln\frac{0.98}{0.02} =\ln49\approx3.89 }$$
#### 5. 从一对细胞a,b推广到两组细胞 A, B

论文从两组细胞反复抽取细胞对，计算 $K_g^{(i)}$，随后对 BF 取平均，衡量基因 G 是否在某一类细胞有更高的表达频率

### 8.4 如何判断差异表达分析是否准确？

作者使用两种数据来验证 scVI：
![Pasted image 20261020204921.png](/papers/scvi/images/Pasted%20image%2020261020204921.png)

对每个基因，bulk 分析会给出经 BH 校正（一种多重假设检验方法，控制错误发生率，即FDR）的 P 值，以处理同时检验大量基因产生的多重比较问题。作者规定：
$$\boxed{ \begin{aligned} P_{\mathrm{BH}}<0.05 &\Rightarrow \text{参考 DE 基因}\\ P_{\mathrm{BH}}\geq0.05 &\Rightarrow \text{参考非 DE 基因} \end{aligned} }$$
随后，由于scVI 可输出每个基因的差异表达证据强度（下称评分），因此可以进行基因排序。

为了判断排序的**正确性**，作者用 bulk 标签计算 **AUROC**（ROC曲线下面积）：从参考DE和非参考DE中各取一个，前者评分更高的概率，越高越好

为了判断排序的**一致性**，作者还计算了 **IDR** （不可重复发现率），评价两套基因统计排序中信号的可重复性，并通过**可重复信号混合权重** $p$ 来衡量，$p$ 越高越好

### 8.5 Fig3

#### a-b：比较不同方法

![Pasted image 20261020210926.png](/papers/scvi/images/Pasted%20image%2020261020210926.png "width=331")![Pasted image 20261020210941.png](/papers/scvi/images/Pasted%20image%2020261020210941.png "width=330")

scVI(NoLib)是不含 $l_n$ 的简化版本
+ 蓝色箱线图：可重复信号混合权重 $p$
+ 绿色箱线图：AUROC

**3a**：B 细胞 & 树突状细胞
+ p：scVI最高
+ AUROC：edgeR 略优于 scVI
由此可见，edgeR 的 AUROC 更高，而 scVI 的差异表达排序与 bulk 参考结果**重复性**高

**3b**：CD4 & CD8 T细胞
+ p：scVI最高
+ AUROC：依旧scVI最高
由此可见，scVI 在 T 细胞比较中 AUROC 优异，并在两个差异表达任务中可重复性最高

#### c-f 哪些基因差异表达结果一致？

![Pasted image 20261020211955.png](/papers/scvi/images/Pasted%20image%2020261020211955.png)
![Pasted image 20261020212015.png](/papers/scvi/images/Pasted%20image%2020261020212015.png)

以B细胞和树突状细胞为例，涉及多个基因：
+ 横轴：单细胞方法给出的 差异表达统计量
	+ scVI：对数后验赔率$K_g$
	+ 其他：校正 P 值对数统计量
+ 纵轴：Bulk 微阵列参考的 差异表达统计量
+ 红色竖线：单细胞方法的显著性阈值
+ 红色横线：Bulk参考中 BH 校正 P 值为 0.05 的阈值

**读图**：看横纵坐标符号是否一致，期望看到 **左下** → **右上** 的方向分布
![Pasted image 20261020212948.png](/papers/scvi/images/Pasted%20image%2020261020212948.png)

而图中的 P ，指的是**可重复信号成分的混合权重**，衡量差异表达证据的重复性，scVI最好

由此可轻松看出，scVI在差异表达方面，效果极佳

### 8.6 scVI 差异表达分析的局限性

#### 1. bulk 参考结果不代表绝对正确

因为 bulk 参考本身也是统计估计，因此Fig3证明的是与独立表达实验的一致性，而不是差异表达基因的真实准确性

#### 2. 只验证两类细胞比较任务

没有扩展到多类细胞的比较任务

#### 3. scVI 检验的是相对表达频率的 **方向**

判断式子为：
$$H_1^g:r_g(z_a)>r_g(z_b)$$
并没有量化相对表达的差异，只是孰大孰小。微微大于和远大于都一样

#### 4. 后验不确定性和batch混杂

模型依赖两个前提：
1. **近似后验足够合理**，但实际上可能存在偏差，影响后续差异表达证据
2. **batch** **与生物学状态可区分**，但如果A全来自于batch 1，而B全来自于 batch 2，则表达差异难以区分是细胞类型带来的，还是批次效应
