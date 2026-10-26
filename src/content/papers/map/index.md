---
title: MAP：机制感知扰动预测精读
summary: 梳理 MAP 的知识图谱、多模态预训练与扰动预测流程，记录模型评估和药物筛选实验。
readWeek: 秋6周
cover: /papers/map/images/Pasted%20image%2020261025120957.png
tags:
  - 单细胞
  - 扰动预测
  - 知识图谱
---

# 一、概览

MAP （Mechanism-Aware Perturbation Predictor）的目标：**给定药物和细胞的基础状态，预测药物作用后，基因转录组的变化**。

公式（1）：

$$
f_\theta:(x,p)\longrightarrow\hat{x}^{(p)}\tag{1}
$$

其中 $p$ 是一种小分子扰动

模型采取零样本预测，即对训练集无对应扰动的对象进行预测，分为两种情况：
+ 未见细胞 x 药物
+ 未见药物

实验数据为：

| 数据集          | 细胞背景    | 本文用途     |
| ------------ | ------- | -------- |
| Tahoe-100M   | 6 种癌细胞系 | 主要预测基准   |
| OP3          | 6 种免疫细胞 | 免疫细胞泛化测试 |
| SciPlex3     | 3 种癌细胞系 | 独立扰动基准   |
| ComboSciPlex | 双药扰动    | 检验药物组合预测 |

# 二、知识图谱

由于部分药物没有做过扰动实验，所以需要模型了解并运用生物学联系来预测，故有了知识图谱

### 2.1 两类核心节点
+ 药物节点：使用 PubChem Compound ID (CID) 作为标识符
	+ mol：SMILES表示的分子结构
	+ text：名称、作用机制（MOA）和治疗功能描述
+ 基因节点：使用 Ensembl Gene Id 作为标识符
	+ seq：对应蛋白质的氨基酸序列
	+ text：名称、功能和参与的生物学通路

> MOA：指药物通过什么分子作用及生物学过程发挥效益，如某药物可抑制某蛋白质来影响下游信号传导

### 2.2 两类边
+ 药物 → 基因：结合、抑制、激活、调控等
+ 基因 → 基因：调控、蛋白互作、功能关联

同时，均保留自然语言描述

### 2.3 Fig1a：MAP-KG示意图

![Pasted image 20261024161756.png](/papers/map/images/Pasted%20image%2020261024161756.png)

+ 颜色
	+ 紫色：药物
	+ 蓝色：基因
+ 属性
	+ 如 Metformin 的SMILES和MOA
	+ 如 MT-ND1、NDUFA3的定义和蛋白质信息
+ 关系
	+ 如 Metformin 和 MT-ND1 的药物-基因关系
	+ 如 MT-ND1 和 NDUFA3 的蛋白互作关系

# 三、数据编码

### 3.1 编码节点三模态

节点有三种数据，对应三个模态：
+ mol：分子结构
+ seq：氨基酸序列
+ text：自然语言

因此，MAP针对三种数据，训练了三个编码器
![Pasted image 20261024170940.png](/papers/map/images/Pasted%20image%2020261024170940.png)

先采用针对性的编码模型，再针对 MAP-KG 进行知识预训练，得到MAP的专用编码器，如Extended Data Fig.1a-b所示：

![Pasted image 20261024171325.png](/papers/map/images/Pasted%20image%2020261024171325.png)

由此也可看出，同一实体有多种表征，如 Metformin 的 mol 和 text，描述的是同一药物的不同信息。

也因此，为了统一实体表征，将实体名称送入 $\Phi_{text}$ ，得到某实体的规范表征，如a,b图中间所示

**公式（2）**

$$
\begin{aligned}
z_{\mathrm{mol}}&=\Phi_{\mathrm{mol}}(k_{\mathrm{mol}})\\ z_{\mathrm{seq}}&=\Phi_{\mathrm{seq}}(k_{\mathrm{seq}})\\ z_{\mathrm{text}}&=\Phi_{\mathrm{text}}(k_{\mathrm{text}}) \\
z_i&=\Phi_{\mathrm{text}}(\text{name}(e_i)) 
\end{aligned}\tag{2}
$$


这些向量均属于 $\mathbb R^d$

### 3.2 拉近同一实体的不同属性

倘若有某药物，$z_i$ 与对应 $z_{mol}$ 之间相似度不大，则可以将这两个向量组成 **正样本**，即训练数据里应当匹配的一对表征；对应的，不属于当前匹配对的则作为**竞争配对**
![Pasted image 20261024174451.png](/papers/map/images/Pasted%20image%2020261024174451.png)
这种利用匹配和不匹配关系来训练表征的方法，称作 **对比学习**，而 MAP 采用的第一种监督策略称为 **节点内属性对齐**：
+ 同一药物：name, mol, text应在表征空间里互相关联
+ 同一基因：亦是如此

不过，该方法仅使用了节点信息

### 3.3 编码关系

首先定义关系**文本**为 $r_{ij}$
+ $e_i$：关系起点实体，如 Merformin
+ $e_j$：关系终点实体，如 MT-ND1

利用已有 BioBERT，可将 **文本** 编码为 **向量**，得**公式（3）**：

$$
z_{ij}=\Phi_{\mathrm{text}}(r_{ij}) \tag{3}
$$


对于同一条关系，为了区分两实体所扮演的不同角色，作者引入 **关系条件组合函数**，记为$\phi_{\mathrm{rc}}$，可接受两向量，输出包含关系上下文的新向量，称作 **实体在特定关系中的条件表征**

$\phi_{\mathrm{rc}}$使用MLP架构。如**公式（4）**

$$
\begin{aligned} z_{i\to j}&=\phi_{\mathrm{rc}}([z_i,z_{ij}])\\ z_{j\leftarrow i}&=\phi_{\mathrm{rc}}([z_{ij},z_j]) \end{aligned}\tag{4}
$$

其中：
- $z_{i\to j}$ 表示 $z_i$ 在指向 $z_j$ 的关系中的表征
- $z_{j\leftarrow i}$ 表示 $z_j$ 在接受来自 $z_i$ 的关系时的表征

这样，同一**药物**（$\mathbf z_i$）参与不同**关系**（$\mathbf z_{ij}$）时，可得不同的**关系条件表征**（$\mathbf z_{i\to j}$）

### 3.4 拉进同一关系的不同实体

以 Metformin — inhibit → MT-ND1为例，如图Extended Data Fig. 1c所示
![Pasted image 20261024205219.png](/papers/map/images/Pasted%20image%2020261024205219.png)

+ 通过 $\Phi_{text}$ 得到 $e_i, r_{ij}, e_j$ 的编码向量 $z_i, z_{ij}, z_j$
+ 通过 $\phi_{\mathrm{rc}}([z_{ij},z_j])$ 得到 $z_{j\leftarrow i}$
+ 训练时，让**正样本** $z_i$ 和 $z_{j\leftarrow i}$ 更匹配（Pull）
+ 同时，让 $z_i$ 与其他关系条件表征，即**竞争配对**更加不匹配（Push）

以上即为 MAP 的第二种监督策略：**节点间关系对齐**

### 3.5 用 InfoNCE 训练这些表征

综上，得两类**正样本**配对：

| 监督类型    | 正样本配对                                                            |
| ------- | ---------------------------------------------------------------- |
| 节点内属性对齐 | $z_i$ ↔ $z_{mol} \quad or \quad z_{seq} \quad or \quad z_{text}$ |
| 节点间关系对齐 | $z_i$ ↔ $z_{j\leftarrow i}$                                      |
即 $(z_i, z'_i)$，其中 $z'_i$ 可以为 $z_{mol} \quad or \quad z_{seq} \quad or \quad z_{text} \quad or \quad z_{j\leftarrow i}$
#### **简单理解**：

计算**正样本**配对和其他配对的相似度，并通过softmax来计算得到正样本配对的权重$P_{\mathrm{positive}}$。而训练损失采用正确配对权重的负对数，即

$$
\ell=-\log P_{\mathrm{positive}}
$$

#### **完整公式**

**InfoNCE** 是一种对比学习损失：给定锚点，在候选表征中，提高正确匹配项的相对相似度。

一个训练批次的完整损失公式（5）如下


$$
\begin{aligned} \mathcal L=-\frac{1}{|\mathcal B|} \sum_{i\in\mathcal B}\Bigg[ &\log \frac{\exp(\operatorname{sim}(z_i,z'_i)/\tau)} {\sum_{k\in\mathcal B}\exp(\operatorname{sim}(z_i,z'_k)/\tau)}+\log \frac{\exp(\operatorname{sim}(z_i,z'_i)/\tau)} {\sum_{k\in\mathcal B}\exp(\operatorname{sim}(z_k,z'_i)/\tau)} \Bigg] \end{aligned} \tag{5}
$$


其中：

| 符号                        | 含义                   |
| ------------------------- | -------------------- |
| $\mathcal B$              | 配对索引集合               |
| $\|\mathcal B\|$          | 配对数量                 |
| $z_i$                     | 第 $i$ 个实体的名称规范表征     |
| $z'_i$                    | $z_i$ 对应正样本，从属性或关系而来 |
| $z'_k$                    | $z_k$ 对应的正样本         |
| $\operatorname{sim}(a,b)$ | 余弦相似度                |
| $\tau$                    | softmax 温度           |

+ 第一项
	+ 固定 $z_i$ ，从诸多对应正样本$z'_1,z'_2,\ldots$ 中识别自己的正确配对 $z'_i$
	+ 即促使 $z_i\rightarrow z'_i$
+ 第二项
	+ 固定 $z'_i$ ，从诸多样本$z_1,z_2,\ldots$ 中识别自己的正确样本 $z_i$
	+ 即促使 $z'_i\rightarrow z_i$

随后，对两方向负对数匹配权重求和，再对小批量求平均
![Pasted image 20261025113934.png](/papers/map/images/Pasted%20image%2020261025113934.png)

该方法称作 **对称对比学习**

### Fig1.b

![Pasted image 20261025114639.png](/papers/map/images/Pasted%20image%2020261025114639.png "width=406")

其中
+ （空心+实心）：关系条件表征
+ 黄色区域：节点内属性对齐
+ 蓝色区域：节点间关系对齐

### 3.6 编码器预训练总结

1. 构建 MAP-KG：获得药物、基因的属性和关系
2. 多模态编码：得到实体、属性和关系向量，如公式（2）、（3）

$$
\begin{aligned}
z_{\mathrm{mol}}&=\Phi_{\mathrm{mol}}(k_{\mathrm{mol}})\\ z_{\mathrm{seq}}&=\Phi_{\mathrm{seq}}(k_{\mathrm{seq}})\\ z_{\mathrm{text}}&=\Phi_{\mathrm{text}}(k_{\mathrm{text}}) \\
z_i&=\Phi_{\mathrm{text}}(\text{name}(e_i)) 
\end{aligned}\tag{2}
$$


$$
z_{ij}=\Phi_{\mathrm{text}}(r_{ij}) \tag{3}
$$

3. 关系条件组合：将实体表征和关系文本结合，如公式（4）

$$
\begin{aligned} z_{i\to j}&=\phi_{\mathrm{rc}}([z_i,z_{ij}])\\ z_{j\leftarrow i}&=\phi_{\mathrm{rc}}([z_{ij},z_j]) \end{aligned}\tag{4}
$$

4. 对比预训练：利用属性和关系配对，调整表征空间，如公式（5）

$$
\begin{aligned} \mathcal L=-\frac{1}{|\mathcal B|} \sum_{i\in\mathcal B}\Bigg[ &\log \frac{\exp(\operatorname{sim}(z_i,z'_i)/\tau)} {\sum_{k\in\mathcal B}\exp(\operatorname{sim}(z_i,z'_k)/\tau)}+\log \frac{\exp(\operatorname{sim}(z_i,z'_i)/\tau)} {\sum_{k\in\mathcal B}\exp(\operatorname{sim}(z_k,z'_i)/\tau)} \Bigg] \end{aligned} \tag{5}
$$

5. 得到预训练后的知识编码器：让模型只需根据SMILES式，即可生成新药物的表征

# 四、模型推理

![Pasted image 20261025120957.png](/papers/map/images/Pasted%20image%2020261025120957.png)

可见该模型有三条输入分支
+ 细胞状态：未扰动细胞的基因表达，记作 $x$
+ 基因信息：基因对应的蛋白质序列
+ 药物信息：SMILES 式和给药剂量，记作 $p$

随后送入Transformer
### 4.1 公式（6）：编码未扰动细胞状态
![Pasted image 20261025123435.png](/papers/map/images/Pasted%20image%2020261025123435.png)

使用已预训练好的单细胞基础模型 **STATE SE-600M**

$$
\begin{aligned}
T,h=\Phi_{\mathrm{scfm}}(x)\\
T\in\mathbb R^{G\times d},\qquad h\in\mathbb R^d
\end{aligned}\tag{6}
$$

其中：
+ 基因级编码 $T$：一共 G 行，每行对应一个基因的 token
	+ 该 token 包括基因在该细胞下的特征、
	+ 来自 **未扰动细胞**

$$
T= \begin{bmatrix} t_1\\ t_2\\ \vdots\\ t_G \end{bmatrix}, \quad t_g\in\mathbb R^d
$$

- 细胞级编码 $h$：概括细胞全局状态的向量
	- STATE 通过放在基因 token 前的特殊 token 来产生$h$

![Pasted image 20261025122157.png](/papers/map/images/Pasted%20image%2020261025122157.png)

### 4.2 公式（7）：融合细胞状态和基因信息
![Pasted image 20261025123520.png](/papers/map/images/Pasted%20image%2020261025123520.png "width=404")

通过蛋白质序列编码器，得第 $g$ 个基因的向量：

$$
z_\mathrm g^{\mathrm{seq}}=\Phi_{\mathrm{seq}}(k_\mathrm g^{\mathrm{seq}})
$$

将这 $d$ 个向量按照基因 ID 序列堆叠，得到基因的表征矩阵：

$$
Z_{\mathrm{seq}}\in\mathbb R^{G\times d}
$$

随后，作者使用融合网络将两者结合

$$
T_{\mathrm{fuse}} = \phi_{\mathrm{fuse}} \left([T,Z_{\mathrm{seq}}]\right)  \tag{7}
$$

其中，维度从 $2d$ 又变成了 $d$，即

$$
T_{\mathrm{fuse}}\in\mathbb R^{G\times d}
$$

因此，$T_{\mathrm{fuse}}$ 不仅包含了**基因在当前细胞的状态特征** $\mathrm T$，也包含了**对应基因的蛋白特征** $\mathrm Z_{\mathrm{seq}}$

### 4.3 药物分支
![Pasted image 20261025123559.png](/papers/map/images/Pasted%20image%2020261025123559.png)

1. 使用之前训练好的编码器

$$
z_{\mathrm{mol}} = \Phi_{\mathrm{mol}}(\mathrm{SMILES}_p)
$$

2. 加入剂量 $\delta$，一个经对数变换的常数

$$
\tilde z=\delta\cdot z_{\mathrm{mol}}
$$


由于剂量是常数，所以只是对药物向量进行缩放，其对基因表达真正的复杂影响，留到后面的预测网络学习

### 4.4 公式（8-9）：Transformer → 细胞编码 → 基因编码

![Pasted image 20261025124034.png](/papers/map/images/Pasted%20image%2020261025124034.png "width=440")

综上，我们得到了

| 输入                  | 含义                         | 维度          |
| ------------------- | -------------------------- | ----------- |
| $\tilde z$          | 药物及剂量表示                    | $d$         |
| $h$                 | 整个未扰动细胞的状态                 | $d$         |
| $T_{\mathrm{fuse}}$ | 结合细胞状态$T$与基因知识$Z_{seq}$的表示 | $G\times d$ |
随后，拼成 token 序列，送入包含四个 self-attention 的 Encoder，记为$\Phi_{\mathrm{enc}}$

$$
\hat h^{(p)} = \Phi_{\mathrm{enc}} (\tilde z,h,T_{\mathrm{fuse}}) \tag{8}
$$

其中，$\hat h^{(p)}\in\mathbb R^d$ 是模型所预测的：**扰动后的细胞级编码**

随后，为了预测各个基因的表达质，训练了 MLP 预测头$\phi_{\mathrm{dec}}$


$$
\hat x^{(p)} = \phi_{\mathrm{dec}}(\hat h^{(p)})\tag{9}
$$

其中，$\hat x^{(p)}\in\mathbb R^G$ 是模型所预测的：**扰动后的基因表达向量**

对于 $B$ 个未扰动的细胞，将结果堆叠，得到

$$
\hat X^{(p)}\in\mathbb R^{B\times G}
$$


# 五、模型训练

目前，已有前向预测：

$$
(X,p)\longrightarrow (\hat X^{(p)},\hat H^{(p)})
$$


为了训练模型，需反向更新梯度，并使用两种监督信号
+ Expression Loss：让基因表达更准确
+ Embedding Loss：让细胞表征更准确

其中，由于单细胞实验数据常存在较大噪声，所以作者希望模型也能学习扰动后细胞在表征空间中的变化，故引入了 **Embedding Loss**，以优化细胞表征的一致性

![Pasted image 20261025124034.png](/papers/map/images/Pasted%20image%2020261025124034.png "width=440")

如图，从真实给药细胞**基因表达** $x^{(p)}$ 开始：
+ 作为 $\hat x^{(p)}$ 参考值
+ 编码得到 $h^{(p)}$，作为 $\hat h^{(p)}$ 参考值

不过，由于细胞过多，往往会对一组细胞求平均

### 5.1 公式（11-12）：求四均值

假设每组有 $B$ 个细胞

**基因表达空间**：

$$
\begin{aligned} \bar x^{(p)}&=\frac1B\sum_{i=1}^{B}x_i^{(p)}\\ \bar{\hat x}^{(p)}&=\frac1B\sum_{i=1}^{B}\hat x_i^{(p)} \end{aligned} \tag{11}
$$

其中，$\bar x^{(p)},\bar{\hat x}^{(p)}\in\mathbb R^G$：真实细胞和预测结果各自的平均**基因表达**

**细胞表征空间**：

$$
\begin{aligned} \bar h^{(p)}&=\frac1B\sum_{i=1}^{B}h_i^{(p)}\\ \bar{\hat h}^{(p)}&=\frac1B\sum_{i=1}^{B}\hat h_i^{(p)} \end{aligned}\tag{12}
$$

其中，$\bar h^{(p)},\bar{\hat h}^{(p)}\in\mathbb R^d$：真实细胞和预测结果各自的平均**细胞表征**

#### 5.2 公式（10）：完整训练损失


$$
\begin{aligned} \mathcal L_{\mathrm{pert}} &=\mathcal L_{\mathrm{emb}} +\lambda\mathcal L_{\mathrm{expr}}\\ &=\frac1d\left\| \bar{\hat h}^{(p)}-\bar h^{(p)} \right\|_2^2 +\frac{\lambda}{G}\left\| \bar{\hat x}^{(p)}-\bar x^{(p)} \right\|_2^2 \end{aligned}\tag{10}
$$

其中
+ $\lambda$ 为控制基因表达空间损失的权重
+ 由于使用 MSE，为了平均各维度的误差，故分别除以各自的维度 $d$ 和 $G$

# 六、模型评估

#### 6.1 数据来源

论文使用三个主要数据集

| 数据集        | 本文选用的细胞背景 | 药物覆盖种类数 |
| ---------- | --------- | ------- |
| Tahoe-100M | 6 个癌细胞系   | 379     |
| OP3        | 6 类免疫细胞   | 144     |
| SciPlex3   | 3 个癌细胞系   | 187     |
每次测试时，需要三类信息，其中前两类从数据中获得：
- **Control**：未给药的真实细胞
- **Ground truth**：给药的真实细胞
- **Prediction**： MAP 利用 Control 和药物信息生成的预测表达

并记：

$$
\begin{aligned} \mathbf c&\in\mathbb R^G &&\text{控制组平均表达}\\ \mathbf y&\in\mathbb R^G &&\text{真实给药组平均表达}\\ \hat{\mathbf y}&\in\mathbb R^G &&\text{预测给药组平均表达} \end{aligned}
$$



同时，为了减轻数据噪声的影响，论文随机抽取固定数量的细胞，并按条件来聚合，或称 pseudobulk

> Pseudobulk：伪整体表达，即把同一条件下多个细胞的表达信息汇总成一个表达谱 

#### 6.2 HVG & DEG

此外，论文还为每个**数据集**选出 2000 个 HVG，为每个**药物扰动条件**选取 50 个 DEG，其中DEG选择流程为

![Pasted image 20261025154024.png](/papers/map/images/Pasted%20image%2020261025154024.png)

而 DEG 是提前确定好的，所以前50 DEG评估模型对已识别相应基因的预测能力，模型自身不能识别出谁是DEG

### 6.3 评价指标

| 指标                        | 评估方向       | 理想数值 |
| ------------------------- | ---------- | ---- |
| Pearson delta correlation | 转录组变化方向一致性 | 1    |
| Direction Accuracy        | 转录组变化方向正确性 | 1    |
| PDS                       | 药物响应的特异性   | 1    |
| MSE                       | 预测与真实的数值差异 | 0    |
| Wasserstein Distance      | 预测与真实的分布差异 | 0    |

#### 6.3.1 Pearson delta 相关性：方向一致

Delta（$\Delta$）表示相对于控制组的表达变化：


$$
\begin{aligned} \Delta_g &= y_g-c_g\\ \hat\Delta_g&=\hat y_g-c_g \end{aligned}
$$


并由此计算 Pearson相关系数，衡量 $\Delta_g$ 和 $\hat\Delta_g$ 的线性相关程度


$$
r_\Delta= \frac{ \displaystyle\sum_{g=1}^{G} (\Delta_g-\overline{\Delta}) (\hat\Delta_g-\overline{\hat\Delta}) }{ \sqrt{\displaystyle\sum_{g=1}^{G}(\Delta_g-\overline{\Delta})^2} \sqrt{\displaystyle\sum_{g=1}^{G}(\hat\Delta_g-\overline{\hat\Delta})^2} }
$$

若 $\Delta_g$ 和 $\hat\Delta_g$ 呈倍数关系，则 $r_\Delta=1$，但倍数不同，$MSE$ 也不同

#### 6.3.2 Direction Accuracy：方向正确

先使用符号函数来衡量方向

$$
\operatorname{sign}(a)= \begin{cases} 1,&a>0\\ 0,&a=0\\ -1,&a<0 \end{cases}
$$


随后，统计**变化方向相同的基因比例**

$$
\mathrm{DirAcc} = \frac{1}{G} \sum_{g=1}^{G} \mathbb I \left[ \operatorname{sign}(\Delta_g) = \operatorname{sign}(\hat\Delta_g) \right]
$$

其中，指示函数 $\mathbb I[\cdot]$ ：True记为1，False记为0

#### 6.3.3 PDS：药物特异性

为了判断 MAP 预测的是特定药物带来的特定变化，而不是药物带来的平均变化，引入 **PDS**（Perturbation Discrimination Score，扰动区分分数）

设共 $N$ 个条件，表达谱之间距离用 $d(\cdot,\cdot)$ 计算，则对于第 $i$ 个药物扰动：

用 $r_i$ 统计比真实响应 $\mathbf y_i$ 还接近当前预测 $\hat{\mathbf y}_i$ 的其他真实响应 $\mathbf y_j$ 的**数量**：

$$
r_i= \sum_{j=1}^{N} \mathbb I\left[ d(\hat{\mathbf y}_i,\mathbf y_j) < d(\hat{\mathbf y}_i,\mathbf y_i) \right]
$$

然后计算

$$
\mathrm{PDS} = 1-\frac{2}{N^2}\sum_{i=1}^{N}r_i
$$

理想情况下，若所有预测 $\hat{\mathbf y}_i$ 都接近自身真实响应 $\mathbf y_j$，则PDS=1

#### 6.3.4 MSE ：数值差异

即每个基因 **预测值** $\hat y_g$ 和 **真实值** $\hat y_g$ 的差平方


$$
\mathrm{MSE} = \frac1G\sum_{g=1}^{G} (\hat y_g-y_g)^2
$$

#### 6.3.5 Wasserstein Distance ：分布差异

> Wasserstein 距离：可理解为把一个概率分布搬运成另一个分布，需要付出的最小运输成本。

论文为一维分布，则以数值差作为运输成本
![Pasted image 20261025170630.png](/papers/map/images/Pasted%20image%2020261025170630.png)

### 6.4 Baseline 比较

| 模型        | 预测思路                         | 未测定药物任务 |
| --------- | ---------------------------- | ------- |
| trainMean | 靠训练集的平均扰动响应                  | 参与      |
| chemCPA   | 加入药物编码                       | 参与      |
| PRnet     | 利用分子结构与对照细胞                  | 参与      |
| XPert     | 结合生物学特征与化学信息的双分支 Transformer | 参与      |
| CRISP     | 利用预训练细胞模型                    | 参与      |
| STATE     | 使用固定的药物类别标识                  | 不参与     |

# 七、Fig.2：未见细胞

### 7.1 Fig.2a：划分方法

![Pasted image 20261025172948.png](/papers/map/images/Pasted%20image%2020261025172948.png "width=278")
**对于每种Cell lines，留出5%的药物组合作为测试集，不同Cell line的留出药物集互不重叠**

### 7.2 Fig.2b：Tahoe-100M 的总体水平

![Pasted image 20261025173450.png](/papers/map/images/Pasted%20image%2020261025173450.png)

作者使用 Tahoe-100M 的六个癌细胞系，并与其他baseline比较，误差线为 95% CI，使用同一测试集，指标为上述所说的

| 指标                 | 评价基因集合        | 评估方向       |
| ------------------ | ------------- | ---------- |
| Direction Accuracy | Top-50 DEG    | 转录组变化方向正确性 |
| Pearson Δ          | Top-50 DEG    | 转录组变化方向一致性 |
| PDS                | Top-2,000 HVG | 药物响应的特异性   |

### 7.3 Fig.2c：Tahoe-100M 的个体表现

![Pasted image 20261025173945.png](/papers/map/images/Pasted%20image%2020261025173945.png)

2b展示总体水平，2c尽显个体优势。其中，阴影为 95% CI，Average为平均结果。

+ 左图：Top-50 DEG Pearson Δ
+ 右图：Top-50 DEG Direction Accuracy

#### 7.4 Fig.2d：SciPlex3 与 OP3 的总体水平

![Pasted image 20261025175306.png](/papers/map/images/Pasted%20image%2020261025175306.png "width=404")

Tahoe-100M是大规模癌细胞扰动图谱，为了证明MAP在其他数据集也有优势，故在另外两个数据集单独训练了2个新 MAP 模型

由图可知，MAP在不同数据集上，总体表现仍然最佳，不过不如在 Tahoe-100M 上明显

### 7.5 Fig.2e：SciPlex3 与 OP3 的个体表现

![Pasted image 20261025175934.png](/papers/map/images/Pasted%20image%2020261025175934.png)

依旧把细胞系单拎出来看效果，可见MAP依旧领先

# 八、Fig.3：未见药物

### 8.1 Fig.3a：划分方法

![Pasted image 20261025182159.png](/papers/map/images/Pasted%20image%2020261025182159.png "width=279")

**留出 5% 的药物作为测试药物，并在预训练阶段，删除药物的节点、别名及关联边**，确保编码器没有学到测试药物的知识

### 8.2 Fig.3b：Tahoe-100M 的总体水平

![Pasted image 20261025182457.png](/papers/map/images/Pasted%20image%2020261025182457.png)

指标与 Fig.2b 一致，不过左侧为已见药物，右侧为未见药物

由图可见，MAP依旧领先，但并非各个指标都显著领先

### 8.3 Fig.3c：未见药物表现

![Pasted image 20261025183412.png](/papers/map/images/Pasted%20image%2020261025183412.png)

评价指标为 Top-50 DEG Pearson Δ，评估模型对16种未见药物的预测表现，可见MAP依旧相对领先，少数药物表现不稳定，或P值过高，缺乏显著差异的证据

### 8.4 Fig.3d：具体基因表现

![Pasted image 20261025184457.png](/papers/map/images/Pasted%20image%2020261025184457.png)

FC： Fold Change ，即给药组和对照组表达的倍数比，取对数后
+ 正：表达增加
+ 负：表达减弱
+ 零：无倍数变化

其中
+ 横轴：$\text{true log(FC)}$ ，即**真实**基因表达倍数变化的对数
+ 纵轴：$\text{pred log(FC)}$ ，即**预测**基因表达倍数变化的对数
+ 浅紫色：HVG
+ 深紫色：DEG
+ 红线： $y=x$，即 预测 与 真实 一致的位置

由此可见，点越接近红线，则预测变化幅度越真实，所以MAP依旧领先

### 8.5 Fig.3e：SciPlex3 与 OP3 的新药平均表现

![Pasted image 20261025185307.png](/papers/map/images/Pasted%20image%2020261025185307.png)

不难看出，MAP整体来说依旧领先，说明MAP在不同实验来源、不同细胞背景下依旧有效。

# 九、药物筛选

### 9.1 筛选实验

与前文不同，前文是 **预测准确性实验**，而作者新增了一项 **模拟虚拟药物筛选实验**

|     | 前文        | 新增                        |
| :-- | :-------- | :------------------------ |
| 任务  | 预测给药后基因表达 | 利用预测结果给候选药物排序             |
| 输出  | 基因表达向量    | 药物排名、通路分析结果               |
| 评估  | 与真实表达比较   | 检查已知药物的排名，以及预测通路与真实通路是否一致 |
| 目的  | 检查预测是否准确  | 探索预测是否具有实际筛选价值            |

因此，作者使用了以下数据：

+ 细胞背景：A-549（来源于人肺腺癌的癌细胞系）
+ 候选药物：58 种
+ 数据来源：Tahoe-100M
+ 已知阳性参照：5 种药物（具肺癌临床应用背景的已批准药物）

由此，该实验的逻辑为：

**让 MAP 预测 58 种候选药物在 A-549 中的表达响应 → 根据预测结果排序 → 检查能否优先找回五种阳性参考**

### 9.2 GSEA：从基因表达到通路变化

GSEA，即Gene Set Enrichment Analysis，基因集富集分析，可通过所预测的基因表达情况，判断通路变化，最后转换成药物排名。其中，基因集可理解为，根据通路信息所预先定义的一组功能相关基因

为了量化，作者引入了：

**ES**（Enrichment Score，富集分数）：反映某个基因集是否集中出现在基因排序的一端
+ ES > 0：基因集成员倾向于集中在排序前端
+ ES < 0：基因集成员倾向于集中在排序后端

不同基因集的 ES 不方便直接比较，故通过参考分布标准化得到：**NES**（Normalized Enrichment Score，归一化富集分数），反映相对富集程度

### 9.3 Fig.4a：从通路变化到药物排名

综上，假设某药物影响多条相关通路，每条通路有自己的富集结果。接着，作者通过
1. 汇总通路富集结果
2. 得到药物**下调分数**
3. 下调越低，则疾病过程受到更强的抑制，则优先级越高

![Pasted image 20261025220933.png](/papers/map/images/Pasted%20image%2020261025220933.png)
其中，深紫色的为阳性参考

### 9.4 Fig.4b：MAP的筛选效率

依旧和baseline相比，同时，使用的指标为 **Recall@k**，即**前k名召回率**


$$
\mathrm{Recall@}k = \frac{\text{前 }k\text{ 名中的已知阳性药物数}} {\text{全部已知阳性药物数}}
$$

![Pasted image 20261025221147.png](/papers/map/images/Pasted%20image%2020261025221147.png "width=235")
其中，Top k即为榜单的前 k 名，可见MAP依旧领先，即如果只能优先测少量药物的话，MAP可以更早找到已知相关药物

### 9.5 Fig.4c：通路变化是否接近真实

作者开展第三项分析：**基因集层面的机制一致性分析**，用于检验模型预测的基因表达变化是否真的反映了药物引起的生物学过程。
1. 使用fig.4a排名较高的四种阳性参考
2. 对于每种药物，选出12个与A-549有关的基因集
3. 计算 $NES_{\mathrm{pred}}$ 和 $NES_{\mathrm{true}}$ ，并检验两者是否一致

![Pasted image 20261025221549.png](/papers/map/images/Pasted%20image%2020261025221549.png)
其中
+ 纵轴：基因集名称
+ 横轴NES：基因集富集方向及程度
+ 颜色$\log_{10}(1/\mathrm{FDR})$：富集结果统计证据强弱

由此可见，四种药物的 $NES_{\mathrm{pred}}$ 和 $NES_{\mathrm{true}}$ 具有一定的一致性，说明MAP不仅表达谱预测的好，还能在一定程度上恢复 **具有共同生物学功能的基因群的响应模式**
