## Chapter III - Proteins

### 化学组成
* 蛋白质由多肽链和可能的其他组分构成：
    * **辅因子 (cofactors)**：功能性的非氨基酸组分，如金属离子或有机分子。
    * **辅酶 (coenzymes)**：有机辅因子，如乳酸脱氢酶中的NAD⁺。
    * **辅基 (prosthetic groups)**：共价连接的辅因子，如肌红蛋白中的血红素。
    * **翻译后修饰 (posttranslational modifications)**：如糖基化

### 蛋白质纯化技术

分离依赖于蛋白质物理和化学性质的差异：
* 电荷
* 大小
* 对配体的亲和力
* 溶解度
* 疏水性
* 热稳定性

#### 柱层析(Column Chromatography)
又名色谱法

##### 原理
+ 柱层析允许使用液体来动员蛋白质在固体（多孔矩阵）上分离蛋白质混合物。
+ 对固相亲和力较低的蛋白质将首先被洗掉;亲和力较高的蛋白质将在柱上停留更长时间，然后被洗掉
  <img src="image-1.png" alt="alt text" style="width:50%; height:auto;"/>
##### 分类及依据
* **离子交换(Ion Exchange)层析**：根据蛋白质在特定pH下的**净电荷**进行分离。
<img src="images/Biochemistry/76.png" alt="alt text" style="width:50%; height:auto;"/>
* **分子排阻(Size Exclusion)层析**（或凝胶过滤）：根据蛋白质的**大小**进行分离，大分子先被洗脱。
  <img src="images/Biochemistry/77.png" alt="alt text" style="width:50%; height:auto;"/>
* **亲和(Affinity)层析**：利用蛋白质对其特异性配体的高**亲和力**进行分离。
  <img src="images/Biochemistry/78.png" alt="alt text" style="width:50%; height:auto;"/>

#### 电泳 Electrophoresis
##### 聚丙烯酰胺凝胶电泳 (PAGE)
在电场中，蛋白质根据其电荷、大小和形状在凝胶基质中迁移。
<img src="images/Biochemistry/82.png" alt="alt text" style="width:50%; height:auto;"/>
##### SDS-PAGE (sodium dodecyl sulfate polyacrylamide gel electrophoresis)十二烷基硫酸钠-聚丙烯酸凝胶电泳
- SDS能使蛋白质**解折叠**，让蛋白质变成螺旋状，然后烷基链插入每个螺旋之间，暴露出带负电的磺酸基，这样就能让蛋白质**带负电**，结合比约为1g蛋白质：1.414gSDS
	+ **不能用SDS-PAGE分离的蛋白：分子量相近的，不满足这样的结合比的、展开后不是螺旋结构的、表面自带很多电荷的......**
- 施加外部电场之后，蛋白质就能在凝胶中**向正极迁移**
- SDS电泳迁移速率与蛋白质原来的形状无关，只和**分子量**有关
- 小分子迁移的快
- 电泳结束可以进行考马斯亮蓝染色
	+ G250反应迅速可用于定量
	+ R250反应较慢（40min），但可以被洗脱，且灵敏度高（下限0.1μg）
- 电泳的Marker：都是单链的、纯粹由氨基酸组成的（即没有糖基化等修饰）
	+ Marker指已知分子量的标准蛋白
	+ 可用于计算未知蛋白的分子量：相对迁移距离正比于分子量的负对数
	+ **含有糖基化、脂质修饰的蛋白不可以用这种方法测量分子量**
<img src="images/Biochemistry/81.png" alt="alt text" style="width:50%; height:auto;"/>
##### Isoelectric Focusing 等电聚焦
+ 使用两性电解质，施加电场后从负极到正极会形成从高到底的ph梯度
+ 在中央点样，蛋白质会移动到等电点的位置，此时蛋白质带电量为0，不再迁移
+ 一般需要施加3000V的电压
<img src="images/Biochemistry/80.png" alt="alt text" style="width:50%; height:auto;"/>
### 蛋白质定量技术
#### 吸光度法
+ 对于已知含有芳香环氨基酸的蛋白质可以使用**朗伯-比尔定律**测定UV吸光度定量
    $$A = \epsilon \cdot c \cdot l$$
    其中 A 是吸光度，ε 是摩尔吸光系数，c 是浓度，l 是光程。

#### 比活力测定
+ **活力 (Activity)**：反应目标蛋白的功能状况
+ **比活力 (Specific activity)**：指每毫克蛋白的活力单位数
+ 比活力越高，蛋白纯度越高

<img src="/images/Biochemistry/08.png" alt="08" style="width:50%; height:auto;"/>

### 蛋白质测序技术
#### Edman's Degradation
* 一种经典的测序方法，从多肽的**N-末端**开始，逐个对氨基酸进行修饰、切割和鉴定。
* 可用于鉴定具有已知序列的蛋白质
* 该过程已实现自动化，但通常只适用于较短的肽链（约50个残基）。
  **步骤：**
* 先在碱性环境下PITC与目标肽链氨基末端耦合
* 再酸性环境中切断
* 进一步转化为较为稳定的PTH-氨基酸
* 色谱检测PTH-氨基酸种类
* 开启下一轮反应

<img src="/images/Biochemistry/09.png" alt="09" style="width:50%; height:auto;"/>

#### 酶切法
某些酶可以识别特定的氨基酸序列并在特定位点切断肽链

#### 质谱法
* **电喷雾电离质谱 (ESI-MS)** 和 **串联质谱 (Tandem MS)**：肽段首先被离子化并根据质荷比（m/z）分离，然后被破碎成更小的片段，通过分析这些片段的质量差，可以推断出氨基酸序列。
* 质谱法还可用于鉴定翻译后修饰。
<img src="images/Biochemistry/79.png" alt="alt text" style="width:50%; height:auto;"/>

#### 蛋白质序列与进化关系
* **同源蛋白 (Homologous proteins)**：具有显著序列相似性和共同祖先的蛋白质。
    * **直向同源蛋白 (Orthologs)**：存在于不同物种中，功能通常相同。
    * **旁系同源蛋白 (Paralogs)**：存在于同一物种中，由基因复制产生，功能可能已分化。
* 通过比较不同物种间功能相同的蛋白质序列，可以分析其差异，这些差异反映了进化距离。
* 对多个蛋白质家族的分析可以构建**进化树**，揭示生物体之间的进化关系。

<img src="images/Biochemistry/54.png" alt="alt text" style="width:50%; height:auto;"/>

---

### 第三章 总结
本章中，我们学习了：
* 肽和蛋白质的多种生物学功能。
* 蛋白质中氨基酸的结构和命名。
* 氨基酸和肽的电离特性。
* 蛋白质的分离和分析方法。