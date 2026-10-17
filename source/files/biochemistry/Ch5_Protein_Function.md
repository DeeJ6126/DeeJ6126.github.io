## Chapter V Protein Function

## 学习目标
* 配体与蛋白质的结合方法
* 蛋白质-配体相互作用的定量和图形化建模
* 珠蛋白与氧及非氧配体的相互作用
* 氧结合的生理学调控
* 抗体-抗原相互作用的机制与控制
* 肌肉收缩的机制
* 肌肉收缩的调控

---

### 蛋白质功能的关键主题
* **配体 (ligands)** 的可逆结合至关重要。
* 配体和结合位点的**特异性**。
* **诱导契合, induced fit**：配体结合常常伴随着构象变化，有时变化剧烈。
* **协同性, cooperativity**：在多亚基蛋白质中，一个亚基的构象变化会影响其他亚基。
* 相互作用可以被**调控**。

### 球状蛋白功能总结
* **储存离子和分子**
    * 肌红蛋白、**铁蛋白 (ferritin)**
* **运输离子和分子**
    * 血红蛋白、**血清素 (serotonin)** 转运体
* **抵御病原体**
    * **抗体 (antibodies)**、**细胞因子 (cytokines)**
* **肌肉收缩**
    * 肌动蛋白、肌球蛋白
* **生物催化**
    * 胰凝乳蛋白酶、**溶菌酶 (lysozyme)**

### 蛋白与其他分子的相互作用
蛋白质与配体的相互作用是一个可逆的、瞬时的化学平衡过程：
$$A + B \leftrightarrow AB$$
* 蛋白质可逆结合的分子称为**配体 (ligand)**，通常是小分子。
* 蛋白质上配体结合的区域称为**结合位点 (binding site)**。
* 配体通过决定蛋白质结构的非共价相互作用进行结合，这使得相互作用是**瞬时**的。

### 蛋白与配体结合的定量描述
配体(L)与蛋白质(P)的可逆结合过程，可以用**缔合速率常数 (association rate constant, $k_a$)** 或**解离速率常数 (dissociation rate constant, $k_d$)** 来定量描述。
$$P + L \underset{k_d}{\stackrel{k_a}{\rightleftharpoons}} PL$$平衡状态时，缔合与解离速率相等：$$k_a[P] \cdot [L] = k_d[PL]$$平衡组分由**缔合平衡常数 ($K_a$)** 或**解离平衡常数 ($K_d$)** 表征：$$K_a = \frac{[PL]}{[P] \cdot [L]} = \frac{1}{K_d}$$

#### 结合率 (Bound Fraction)
在实践中，我们通常测定已占据的结合位点的分数 ($\theta$)：
$$\theta = \frac{\text{结合位点数}}{\text{总位点数}} = \frac{[PL]}{[PL] + [P]}$$通过代入 $K_d$ 或 $K_a$ 的关系式，可以得到：$$\theta = \frac{[L]}{[L] + K_d}$$
这个公式描述了结合分数与游离配体浓度$[L]$和解离常数$K_d$之间的关系，其图形为双曲线。当 $[L] = K_d$ 时，$\theta = 0.5$。

<img src="images/Biochemistry/60.png" alt="alt text" style="width:40%; height:auto;"/>

当配体是气体时，结合通常用**分压 (partial pressures)** 来表示。对于肌红蛋白结合氧气：
$$\theta = \frac{pO_2}{P_{50} + pO_2}$$
其中，$P_{50}$是氧饱和度为50%时的氧分压，相当于气体配体的$K_d$

+ 强结合：$K_d < 10nM$,
+ 弱结合$K_d > 10nM$

### 蛋白结合配体的特异性
#### 锁钥模型 Lock-and-Key
+ 该模型认为蛋白质只能结合某种特定的配体
+ 蛋白质与配体在大小、形状、电荷、亲水性上互补
  <img src="images/Biochemistry/95.png" alt="alt text" style="width:70%; height:auto;"/>
#### 诱导契合模型 Induced-fit
+ 该模型认为配体结合后，蛋白质可能会发生构象变化。这种适应性变化称为**诱导契合**
+ 能够结合地更**紧密**
+ 对不同配体有着**高亲和力**
+ 配体和蛋白质的构象都可能发生改变
<img src="images/Biochemistry/96.png" alt="alt text" style="width:70%; height:auto;"/>

### Case I：Globins (珠蛋白)
+ **Problems**:
    1.  蛋白质侧链对$O_2$缺乏亲和力。
    2.  一些过渡金属能很好地结合$O_2$，但若游离在溶液中会产生活性氧自由基。
    3.  像血红素这样的有机金属化合物更合适，但游离血红素中的Fe²⁺容易被氧化成Fe³⁺。
+ **Solutions**：用蛋白质包裹血红素来捕获氧气
+ **肌红蛋白 (Myoglobin)** 用于储存氧气，**血红蛋白 (Hemoglobin)** 用于运输氧气，它们都通过蛋白质结合的血红素来结合氧气

#### 血红素 Heme
一类中心含有二价铁离子的卟啉化合物，除了在血红蛋白中负责结合氧气外，还是肌红蛋白、细胞色素、细胞色素P450、过氧化氢酶、过氧化物酶等多种蛋白的辅因子，并参与调控基因表达、miRNA加工、昼夜节律等过程。
<img src="images/Biochemistry/61.png" alt="alt text" style="width:60%; height:auto;"/>

#### 肌红蛋白 myoglobin
+ 血红素在中心被两个组氨酸锚定
<img src="images/Biochemistry/97.png" alt="alt text" style="width:50%; height:auto;"/>

+ CO通过与氧气竞争，阻断肌红蛋白、血红蛋白和线粒体**细胞色素 (cytochromes)** 的功能，因而具有剧毒
+ 一氧化碳与血红素的结合强度比氧气强20000倍，因为CO与铁是直线连接，氧气则有一个夹角 -> 一氧化碳中毒
  <img src="images/Biochemistry/62.png" alt="alt text" style="width:60%; height:auto;"/>
+ 检测：空载的血红素有429nm紫外吸收峰，结合氧气之后吸收峰移动到414nm
*（这可以解释静脉血和动脉血的颜色差异原因）*

#### 血红蛋白 hemoglobin
##### *为什么肌红蛋白不能运输氧气？*
* 肌红蛋白对氧气有非常高的亲和力（$P_{50}$ 仅为 0.26 kPa）。
* 这意味着它在肺部（$pO_2 \approx 13$ kPa）能很好地结合氧气，但在组织中（$pO_2 \approx 4$ kPa）却不能有效释放氧气。因此，肌红蛋白只适合作为氧气的储存蛋白，不适合作为运输蛋白。

##### 协同效应 (Cooperativity)
为了有效地运输氧气，蛋白质对氧的亲和力必须随$pO_2$的变化而变化：在肺部高亲和力结合，在组织中低亲和力释放。
* **协同效应 (cooperativity)**：结合位点可以相互作用
* 通常发生在具有多个结合位点的蛋白质中。
+ 正协同：第一个结合的配体促进之后的配体结合，通过S形结合曲线识别
+ 负协同反之，图像为直线
	<img src="/images/Biochemistry/19.jpg" alt="19" style="width:35%; height:auto;"/>

##### **协同效应的定量描述**
+ 平衡方程修正为：$$K_a=\frac{[PL_n]}{[P][L]^n}$$
+ 结合率修正为： $$\theta = \frac{[L]^n}{[L]^n+K_d}$$
+ 两边取对数得到希尔方程：$$\log(\frac{\theta}{1-\theta}) = n \log [L]-\log K_d$$
+ **n (Hill系数)** 表示协同程度：
    * n = 1: 无协同作用 (如肌红蛋白)
    * n > 1: 正协同作用 (如血红蛋白, n ≈ 3)
    * n < 1: 负协同作用
<img src="images/Biochemistry/157.png" alt="alt text" style="width:50%; height:auto;"/>

##### 协同效应模型
* **齐变模型 (Concerted model)**：所有亚基同时从低亲和力状态转变为高亲和力状态。
* **序变模型 (Sequential model)**：配体结合逐个诱导亚基发生构象变化。

##### 别构调控 (Allosteric Regulation)
协同效应是别构调控的一个特例。
* **别构蛋白 (Allosteric protein)**：
  * 配体在一个位点（非催化位点）的结合影响了同一蛋白质上另一个不同位点的结合特性，此时该配体为别构调节剂
  * 分为积极影响和消极影响 
  * **同促效应 (Homotropic effect)**：蛋白质的正常配体本身就是别构调节剂（如氧气对血红蛋白的调节）。
  * **异促效应 (Heterotropic effect)**：不同于正常配体的分子影响正常配体的结合。
* 协同性=正同向调节
 Cooperativity = Positive Homotropic Regulation
##### 血红蛋白的结构：
+ 血红蛋白 (**Hb**) 是一个**α₂β₂四聚体**，每个亚基都与肌红蛋白相似
+ 当第一个氧气结合时，α1 β2 链之间的构象会改变，多个离子键断裂
+ Tense state：更多的相互作用，更稳定，对氧气的亲和力低
+ Relaxed state: 更少的相互作用，更自由，对氧气的亲和力高
+ 氧气的结合促使从T -> R的转变
<img src="images/Biochemistry/63.png" alt="alt text" style="width:70%; height:auto;"/>
##### pH值对血红蛋白运输氧气的影响
+ 活跃代谢的组织产生$H^+$,使得肌肉组织的pH值比肺部低，
+ $H^+$可以稳定T构象，原理是可以质子化$His^{146}$，然后和$Asp^{94}$之间形成盐桥，促进氧气的释放
+ 肺部和代谢组织之间的pH差异提高了氧气运输的效率，这种效应称为**玻尔效应** (Bohr Effect)

<img src="/images/Biochemistry/image-20241113191903514.png" alt="image-20241113191903514" style="width:40%; height:auto;"/>

##### 血红蛋白运输二氧化碳
+ 二氧化碳和肽链的氨基末端结合形成氨基甲酸酯末端
+ 过程产生质子，进一步加强Bohr效应
+ 会形成额外的盐桥，稳定T构象，促进氧气释放
<img src="images/Biochemistry/98.png" alt="alt text" style="width:70%; height:auto;"/>
##### 2,3-二磷酸甘油酸 （2,3-BPG）对氧气运输的调节
+ 2,3-BPG是血红蛋白功能的**负向异促调节剂**
+ 这是糖酵解中产生的小型负电分子
+ 可以和血红蛋白中心的正电空腔相结合，**稳定T态**，促进氧气释放
+ 可以让组织适应不同的海拔高度，高海拔地区提高该物质浓度，增加氧气运输效率
<img src="/images/Biochemistry/20.jpg" alt="20" style="width:40%; height:auto;"/>

##### 镰状细胞性贫血症 Sickle-Cell Anemia
+ 血红蛋白β链第六位谷氨酸Glu突变为缬氨酸Val (β6:Glu→β6:Val) 
+ 突变后的β链可以结合其他的血红蛋白分子，最终大量分子聚集形成不溶性纤维，使红细胞变成镰刀状
+ 基因突变导致，纯合子个体幼年死亡
+ **杂合子 (Heterozygous)** 个体对**疟疾 (malaria)** 表现出抵抗力
---
### Case II : Antibody/Antigen Interaction(抗体抗原结合)

#### 两种免疫系统

##### 细胞免疫
+ 攻击已被感染的自身细胞。
+ 主要参与者：巨噬细胞、杀伤性T细胞。
  <img src="images/Biochemistry/99.png" alt="alt text" style="width:70%; height:auto;"/>
##### 体液免疫
+ **抗原 (Antigen)**：刺激抗体产生的物质，通常是免疫系统识别为“外来”的**大分子**（如病毒的包膜蛋白、细胞或病毒的表面碳水化合物）
+ **抗体 (Antibody)**：由B细胞产生，特异性结合抗原的蛋白质 
    + 结合将标记抗原以破坏或干扰其功能
    + 一个抗原可以有**多个表位**(epitope)，但一种抗体只能结合一个表位

#### 抗体
##### 免疫球蛋白 G （IgG）
* 是主要的抗体类型，呈Y形。
* 由两条相同的**重链 (heavy chains)** 和两条相同的**轻链 (light chains)** 组成。
* 链由**恒定区 (constant domain)** 和**可变区 (variable domain)** 组成。
* 可变区构成了**抗原结合位点**，其序列高度可变，赋予了抗体的特异性。
* 经木瓜蛋白酶切割可分为两个**Fab**（抗原结合片段）和一个**Fc**（可结晶片段）区域。
* **巨噬细胞 (Macrophages)** 表面的Fc受体可以识别并结合包被了IgG的病原体，通过**吞噬作用 (phagocytosis)** 将其清除。
* 与抗原诱导契合结合，一个IgG可以结合两个抗原
<img src="images/Biochemistry/64.png" alt="alt text" style="width:35%; height:auto;"/>

##### 抗体类别
* **IgG**: 次级免疫应答中的主要抗体，血液中最丰富。
* **IgA**: 主要存在于分泌物中（唾液、眼泪、乳汁）。
* **IgE**: 在过敏反应中起重要作用。
* **IgM**: 初级免疫应答早期产生的主要抗体，以**五聚体**形式分泌。
* **IgD**: 功能尚不完全清楚。

##### 免疫交联技术
+ 底物、一抗与底物结合、被改造过的二抗（能和化学荧光物质结合或能催化颜色反应）与一抗结合、荧光物质能与二抗结合并被检测到或产生颜色反应
+ 应用实例：**ELISA（酶联免疫吸附测定）技术检测人单纯疱症病毒HSV**，一抗是抗HSV抗体，二抗是连接有辣过氧化物酶的人IgG，HSV载量最后反应为黄色的深浅
<img src="images/Biochemistry/65.png" alt="alt text" style="width:70%; height:auto;"/>
---

### Case III：Muscle Proteins （肌蛋白）
#### 肌肉的结构
+ 肌球蛋白Myosin 和 肌动蛋白Actin  -> 肌原纤维 -> 肌纤维 (muscle fibers) -> 肌肉
  <img src="images/Biochemistry/100.png" alt="alt text" style="width:70%; height:auto;"/>
+ **肌球蛋白：**
  + 组成粗的丝状物
  + 头部氨基端纺锤状，有ATP酶活性
  + 尾部是两股α螺旋
  + 头部沿着肌动蛋白滑动，使肌小节缩短
+ **肌动蛋白：**
  + 组成细的丝状物
  + F-肌动蛋白是两个G-肌动蛋白单体以右手的方式相互螺旋的一种丝状集合体
#### 肌肉的运动需要化学能
+ 肌动球蛋白循环：每消耗一个ATP，肌球的头往前跨两节
#### 肌肉收缩的调节
+ 神经冲动导致钙离子的释放
  + 引起整个复合体（tropomyosin-troponin complex）构象改变，暴露肌动蛋白结合位点
+ **原肌球蛋白 (Tropomyosin)** 和**肌钙蛋白 (Troponin)** 可调节肌动蛋白上的肌球蛋白结合位点的可用性
  + 防止肌肉持续收缩

---

### Case IV：胰高血糖素样肽-1 (GLP-1)
+ **GLP-1和胰高血糖素, GLP-2**由同一个基因编码，先生成前胰高糖素原，切除信号肽后形成胰高糖素原，在不同组织中经不同*激素原转化酶（PSCK）*选择性切割为若干胰高糖素原衍生肽

#### The effects of GLP-1 and GLP-1RA
+ 降血糖
+ 控肥胖
+ 护心脏
+ 与很多生命过程相关
  
---

## 第五章 总结
本章中，我们学习了：
* 配体结合如何影响蛋白质功能。
* 如何定量分析结合数据。
* 肌红蛋白如何储存氧气。
* 血红蛋白如何运输$O_2$、质子和$CO_2$。
* 抗体如何识别外来结构。
* 肌肉如何工作。