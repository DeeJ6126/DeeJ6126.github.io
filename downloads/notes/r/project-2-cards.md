目标：设计扑克牌模拟系统，可以自动洗牌和发牌，且可以记住发牌结果

- 第三章：创建一副牌

- 第四章：编写发牌洗牌的函数

- 第五章：改变点数系统

# 3. R对象

## 3.1 原子型向量 atomic vector

在R中，最简单的对象类型叫做原子型向量，也是最简单的包含数据的向量，是构成其他对象类型的基本元素。R中绝大多数数据结构都是由原子型向量构成的。

```r
die <- c(1,2,3,4,5,6)
is.vector(die)
```

> 可以通过`is.vector()` 测试某个对象是否为原子型向量

也可以生成只包含一个值的原子型向量，其长度为1

```r
five <- 5
is.vector(five)
length(five)
length(die)
```

> `length()`函数可以返回原子型向量的长度

原子型向量将其值存储在一维向量中，且只能是一种类型的数据。可以使用不同类型的原子型向量存储不同类型的数据，如

- 双整形 double

- 整形 integer

- 字符型 character

- 逻辑型 logical

- 复数类型 complex

- 原始类型 raw

若要存储不同类型的数据，可以使用简单的R规范，如`int` 的数字后加`L` ，`character` 两边有`""`。

如果想生成包含多个元素的原子型向量，也可以用`c()` 包起来

```r
int <- c(1L, 5L)
text <- c("ace", "heart")
```

若要知道自己的对象是什么格式，可以使用`typeof()` 函数

```r
typeof(die)
```

### 3.1.1 双整型double

存储普通的数值型数据，可正可负，可大可小，可整可分，且为默认数值格式。

有一些函数将双整型称作 **数值型numeric**

### 3.1.2 整型int

存储整型的数据，无小数点成分。如果要设置整型，需要在数值后加`L`，否则默认是double

int最大的好处是可以避免**浮点误差floating-point：**

- 计算机会分配64byte的内存来表示double对象

- 但有些不能用64个0或1表达，如$\sqrt{2}$，因此必须四舍五入

- 所以很多double大约精确到小数点后16位，如下

```r
sqrt(2)^2 - 2
```

### 3.1.3 字符型 char

存储一段文本，需要由`""`包裹。其中字符型向量的单个元素称作 **字符串string**

```r
char <- c("Hello", "123", "!@#")
char
typeof(char)
```

### 3.1.4 逻辑型

用来存储 `TRUE` 和 `FALSE`，或 `T` 和 `F`

```r
3 > 4
typeof(3 > 4)
typeof(F)
```

### 3.1.5 复数类型和原始类型

复数类型即用来存储复数

```r
comp <- c(1 + 1i, 2 + 2i)
typeof(comp)
typeof(1 + 0i)
```

原始类型向量即用来存储数据的原始字节。可以使用`raw(n)` 来生成长度为n的空原始类型向量

```r
raw(3)
typeof(raw(3))
```

### 3.1.6 生成扑克牌

以黑桃(spades)A +黑桃 K + 黑桃Q + 黑桃J + 黑桃10为例

```r
hand <- c("Ace", "King", "Queen", "Jack", "10")

hand
```

为了更加复杂，可以构建一个二维的表格型数据，并包含花色信息。因此，需要赋予他 **属性attribute** 和 **类class**

## 3.2 属性

属性是附加给原子型向量的额外信息，可以理解为对象的 **元数据metadata** ，可以将与该对象有关的信息以便捷的形式存起来并附加给该对象。

可以使用`attributes()` 函数查看对象包含哪些属性信息。如果没有，则为`NULL`

原子型常见的三种属性：

- 名称 name

- 维度 dim

- 类 class

### 3.2.1 名称属性

每种属性都有各自的辅助函数，将相应属性附加给R对象，也可以查询对象的属性是什么，如

```r
names(die)

names(die) <- c("one","two","three","four","five","six")

names(die)

attributes(die)

die
```

由于名称属性对实际值无影响，所以即使改变元素取值，属性也不会变

```r
die + 1
```

如果要修改，只需要将新的名称赋给`names`函数即可

```r
names(die) <- c("01","02","03","04","05","06")
die

names(die) <- NULL
die
```

### 3.2.2 维度属性

原子型向量可以转换成 n 维 **数组array**，可以使用 `dim()`函数来赋予维度属性。

如果把向量的`dim` 属性设定为`n` ，则R会将元素重排列到`n`维

```r
dim(die) <- c(2,3) # 2行3列
die

dim(die) <- c(1,2,3) # 1行2列3切片
die
```

分配维度属性时，R将第一个值赋给行数，第二个值赋给列数。

通常来说，R以列为优先，例如先固定第一行，然后填入第一列，满了再到第二列。如果想改变，则可以使用辅助函数 `matrix()` 或 `array()`

## 3.3 矩阵matrix

矩阵将数值存储在二维数组，若要生成一个矩阵，需要

- 将原子型向量交给函数`matrix()`

- 使用参数 `nrow` 定义矩阵行数，也可以使用 `ncol` 定义矩阵列数

- 设置参数 `byrow = TRUE` 来以行优先，而非默认的以列优先

```r
m <- matrix(die, nrow = 2, byrow = TRUE)
m
```

## 3.4 数组array

`array()` 函数用来生成n维数组，其功能与`dim()`类似，不如`matrix()`那么灵活。其第一个参数为原子型向量，第二个参数用来表示维度信息，称为`dim`

```r
ar = array(c(11:14, 21:24, 31:34), dim = c(2, 2, 3)) # 2行2列3切片
ar
```

## 3.5 类class

类是原子型向量的特例，如矩阵die是特殊的double向量，每一个元素都是double，但因为重排列有了新的结构。改变die维度时，R就添加了class属性，描述die的新格式。其相比于类型type这种底层格式，更代表这个数据的 **用法**

```r
class(c(1,2,3))
class(1:6)
class("Hello")
class(m)
class(ar)
```

可以使用`class()`函数设置class属性，但不推荐这么做

### 3.5.1 日期和时间

R用一个特殊的类来表示日期和时间

```r
now <- Sys.time()
now

typeof(now)

class(now)
```

- 虽然看着有英文字符，但是类型是double

- 有 `POSIXct` 和 `POSIXt` 两个类

可以通过 `unclass()`函数移除`class`属性，以查看其本质数字。也可以对其本质数字重新赋予类以恢复表象

```r
unclass(now)

mil <- unclass(now)
mil

class(mil) <- c("POSIXct", "POSIXt")
mil
```

### 3.5.2 因子factor

因子在R中用来存储**分类**信息，只能取特定的值，而这些值可能有特殊的顺序规定。这些特性适合记录某项研究中研究对象满足的不同处理水平或其他类型的**分类变量**

以性别为例

- 向`factor()`传递一个原子型向量即可生成因子，如`c("male", "female", "female", "male")`

- R会将向量中的值编码成一串整数值，再将编码的结果存储在 `int` 向量中，如`(2, 1, 1, 2)`

- R会将 `level` 属性和 `class` 属性添加到 `int` 向量中

  - `level` 包含显示因子值的一组标签，可以理解为`int`的表象

    - `1`的`level`为`female`

    - `2`的`level`为`male`

  - `class` 属性包含类——`factor`

```r
gender <- factor(c("male", "female", "female", "male"))

gender

unclass(gender)

typeof(gender) # factor是数值型

attributes(gender)
```

## 3.6 强制转换

有的时候，R会强制转换元素的类型

- 尤其是一个原子型向量里包含不同类型的元素时

![](project-2-cards-assets/clipboard-287696749.png)

- 如果对逻辑型向量进行运算，也会强制转换成`0/1`

- 也可以明确转换的类型，如

```r
as.character(1)

as.logical(1)

as.numeric(FALSE)
```

## 3.7 列表list

列表将数据组织在一维集合中，但是可以容许不同类型的数据（甚至可以套娃）

```r
list(1:6, "R", list(T, F))
```

其中，`[[2]][1]`表示该内容来自第二个元素的第一个子元素。

## 3.8 数据框 data frame

df是列表的二维版本，将向量组织在一个二维表格中，每个向量都是其中一列。列与列直接数据类型可以不同，但列的每个元素数据类型必须相同

![](project-2-cards-assets/clipboard-1926685022.png)

如果想手动创建数据框，需要使用 `data.frame` 函数

```r
df <- data.frame(
  face = c("ace","two"),
  suit = c("clubs","clubs"),
  value = c(1,2)
)
```

> 其实`c()` 和`list()`也可以自定义名称，会被存在names属性中

```r
list(face = "ace", suit = "clubs", value = 1)
c(face = "ace", suit = "clubs", value = "1")
names(c(face = "ace", suit = "clubs", value = "1"))
```

数据框的本质是 **具有`data.frame`类的列表**，可以使用`str()`函数查看列表里哪些对象组织在一起

```r
typeof(df)

class(df)

str(df)

```

如果数据太大，往往不应该手搓，而是加载数据

## 3.9 加载数据

以`deck.csv`为例，在右上角的`Environment`中点击`Import Dataset` 以导入数据，并使用`head()`和`tail()`查看首尾内容，也可以传递第二个参数以了解前/后几行：

```r
deck <- read.csv("data/deck.csv")

head(deck)

tail(deck,1)
```

## 3.10 保存数据

使用 `write.csv` 命令以保存csv文件，且有三个必须参数：

- 数据框的名称

- 保存的文件名

- 是否要在开头添加一列数字，以表示行号

```r
write.csv(deck, file = "data/card.csv", row.names = F)
```

## 3.11 小结

在R中可以将数据保存为5中不同的对象，其中数据框可以存储 **表格型数据tabular data**，也最常见

![](project-2-cards-assets/clipboard-1586906408.png)

# 4. R的记号体系

通过 R 的记号体系来实现R对象中值的选取

## 4.1 值的选取

以数据框为例，若要提取值，应当写出数据框的名称，后紧跟一个中括号。其中两个索引参数，一个行，一个列。对于R来说，有六种常见索引

- 正整数

- 负整数

- 零

- 空格

- 逻辑值

- 名称

### 4.1.1 正整数索引

类似于线性代数中的ij记号，若提取多个值，则用正整数向量代替单一整数即可。**注意：索引从1开始**

![](project-2-cards-assets/clipboard-847489642.png)

```r
head(deck)
deck[1,1]
deck[2,c(1,2,3)]
```

如果有重复的值，那么则会提取多次

```r
deck[c(1,2,1),c(1,2,3)]
```

如果从数据框中提取 2+ 列的数据，则R返回数据框；但如果只提取一列，则R返回向量，可以使用`drop = F`来矫正

```r
class(deck[1,1:2])
class(deck[1,1])
class(deck[1,1,drop = F])
```

### 4.1.2 负整数索引

与正整数的“选取”相反，负整数是“剔除”。通常适用于选取数据框里大部分的行/列的情况

```r
deck[-(1:51),1:3]
```

### 4.1.3 零索引

不会提取任何信息，返回一个空对象，没多大用

```r
deck[0,1:3]
class(deck[0,0])
```

### 4.1.4 空格索引

即表示提取该维度的所有元素，可以提取所有行/列

```r
deck[ ,1:2]
```

### 4.1.5 逻辑值索引

匹配索引值为 `T` 的位置

```r
deck[1,c(T,T,F)]
```

### 4.1.6 名称索引

如果有`name`属性，就可以通过名称提取，常用于提取列

```r
deck[ ,"value"]
```

## 4.2 发牌 + 洗牌

```r
shuffle <- function(){
  random <- sample(1:52, size = 52)
  deck_r <- deck[random, ]
  deck_r[1, ]

}
shuffle()
```

## 4.4 \$ + [[ ]]

R中，可以使用`$`来提取**数据框**的值，例如

```r
deck$value
```

并且， `deck$value` 还是个向量，因此可以套上很多适用于向量的函数

```r
class(deck$value)
sum(deck$value)
```

如果想提取**列表**中的元素，且元素有`name`属性，同样可以使用`$`来提取。但是，与普通方法不同的是：

- 常规方法提取的是一个**列表**对象，即使只有一个值

- 使用`$`时，R会原封不动提取元素，得到**向量**

```r
lst <- list(number = c(1,2), logical = T, string = c("a","b","c"))
lst
lst[1]
class(lst[1])
sum(lst[1])
```

```r
lst$number
class(lst$number)
sum(lst$number)
```

除了使用名称以外，还可以使用 `[[ ]]` 代替 `[ ]` 提取子集。前者返回**向量**，后者返回**列表**

```r
class(lst[[1]])        # 向量
class(lst[1])          # 列表
class(lst[["number"]]) # 向量
class(lst["number"])   # 列表
```

列表就像火车，每个元素都是车厢。

- 使用 `[ ]` 时只会提取车厢，并配上新的火车头成为新的列表

- 使用 `$` 和 `[[ ]]` 时会只留下车厢并返回其中的内容，为向量

![](project-2-cards-assets/clipboard-2987164896.png)

# 5. 对象改值

## 5.1 就地改值

即使用赋值号 `<-` 更改原始对象内部的值

```r
vec <- c(0,0,0,0,0,0)
vec[1] <- 2  # 改一个值
vec[2:4] <- 3:5 # 改多个值
vec[5] <- vec[5] + 1 # 原基础加值
vec[7] <- 7 # 增加新值
vec
```

因此，可以为数据集添加新变量

```r
deck$new <- 1:52
deck
deck$new <- NULL
deck
```

## 5.2 逻辑值取子集

一种精确提取和替换 R 对象中值的方法

### 5.2.1 逻辑测试

R 提供了其中逻辑运算符

- `>`, `>=`, `<`, `<=`, `==`, `!=`

- `%in%` ：测试左边的值是否在右边的对象之中

  - 如 `a %in% c(a, b, c)`，判断`c(a, b, c)`中是否包含`a`

  - 若左边是向量，则依次判断向量的值是否出现在右边的对象中

```r
1 > 2
1 > c(0:2)

1 %in% c(0:2)
c(1:2) %in% c(0:1)
```

如果想快速提取出 `ace` ，则可以先判断哪些是 `ace`

```r
deck$face == "ace"
```

因此，可以批量选中`deck`里`face = "ace"`的牌的`value`

```r
deck$value[deck$face == "ace"]
```

逻辑值取子集可以快速定位、提取并修改数据集的值，即使未知其位置信息

### 5.2.2 布尔运算符

布尔运算符是类似于 与`&` 和 或`|` 的运算符，可以**整合多个逻辑测试的结果**，并输出成 `T` 或 `F`。现有六种布尔运算符：

![](project-2-cards-assets/clipboard-378637920.png)

因此，可以通过布尔运算符以定义 黑桃Q：同时满足 黑桃 + Q

```r
deck$face == "queen" & deck$suit == "spades"
queen_of_spades <- deck$face == "queen" & deck$suit == "spades"  # 存储结果
deck[queen_of_spades, ]
```

## 5.3. 信息缺失

R中的特殊字符 `NA` 代表 **不可用 not available**，不能当做0处理

### 5.3.1 na.rm

该函数可以移除remove对象中的NA值

```r
c <- c(NA,1:9)
mean(c)
mean(c,na.rm = T)
```

### 5.3.2 is.na

由于NA并不清楚其具体值，所以其实 `NA == NA` 会返回 `NA` ，而不是`T`。为了确保能定位NA，可以使用`is.na`

```r
is.na(NA)
is.na(c)
```

## 5.4 小结

当数据量很大时，提取和修改数据往往很难，因此可以使用**逻辑值取子集**的方法来快速实现：

- 先试用**逻辑运算符和布尔运算符**创建逻辑测试

- 将其作为中括号的索引值以提取

- 提取后即可修改
