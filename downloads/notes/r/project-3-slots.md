# 7. 程序

希望写出一个 `play()` 函数，可以抽出3个图标并给出点数

```r
get_symbols <- function() {
  wheel <- c("DD", "7", "BBB", "BB", "B", "C", "0")
  sample(wheel, size = 3, replace = TRUE,   
         prob = c(0.03, 0.03, 0.06, 0.1, 0.25, 0.01, 0.52))
}
```

## 7.1 策略

通常，可以通过三步来简化任务

- 分解成简单任务

- 使用实例

- 通俗语言描述方案并写代码

通常，R程序可以分解成2种子任务

- 有序步骤

- 同类情况

### 7.1.1 有序步骤

即细分为有序的步骤，如`play()`

```r
play <- function(){
  # 1. 生成符号组合
  symbols <- get_symbols()
  # 2. 显示符号组合
  print(symbols)
  # 3. 算分
  score(symbols)
}
```

### 7.1.2 同类情况

识别出该任务有几种类似特性的情况，如 `score()` 函数，需要根据 `symbles` 的不同情况，选择不同算法

## 7.2 if 语句

```r
num <- -2
if(num < 0){
  num <- num * -1
}

num
```

如果 `( )` 内是向量形式的 `T / F` ，则只会使用第一个元素。

## else语句

```r
a <- 1
b <- 1

if(a > b){
  print("a")
} else if(a < b){
  print("b")
} else{
  print("Tie")
}
```

因此，可以将 `score( )` 函数拆分成多个子任务：

```r
if(#情形1：三个符号相同)①{  
  prize <- #查找对应的中奖金额②  
  } else if(#情形2:全是杠){  
    prize <- # 分配5美元奖金  
      } else {  
        #计算樱桃的数量⑤  
        prize <- # 计算中奖金额  
      }  
  #计算钻石的数量⑦  
  #在需要的情况下，把奖金翻倍⑧
```

## 7.4 查找表

如果`symbles`三者相同的话，需要建一个大的if树，为了简化，可以用类似于取子集的方式即创建一个向量来反映映射关系。该向量将符号存储为名称，金额存储为元素值，并将名称和元素值一一对应

```r
payouts <- c("DD" = 100, "7" = 80, "BBB" = 40, "BB" = 25,   
             "B" = 10, "C" = 10, "0" = 0)
payouts["DD"]
unname(payouts["DD"])
```

最终，得到`score()`

```r
score <- function(symbols){
  same <- symbols[1] == symbols[2] && symbols[2] == symbols[3]   
  bars <- symbols %in% c("B", "BB", "BBB")   
  if (same) {   
    payouts <- c("DD" = 100, "7" = 80, "BBB" = 40, "BB" = 25,   
                 "B" = 10, "C" = 10, "0" = 0)   
    prize<- unname(payouts[symbols[1]])   
  } else if (all(bars)) {   
    prize <- 5   
  }else {   
    cherries <- sum(symbols == "C")   
    prize <- c(0, 2, 5)[cherries + 1]   
  }   
  diamonds <- sum(symbols == "DD")   
  prize * 2 ^ diamonds
}
```

# 8. S3

## 8.1 S3系统

即R自带的类系统，掌管R如何处理具有不同类的对象。一些函数会先查询对象的S3类，再根据其类属性作出相应的响应

例如，`print()` 对于一个数值向量，会默认输出数字。但如果添加了 POSIXt 的S3类 `POSIXct` ，print将显示时间

```r
num <- 1000000000
print(num)

class(num) <- c("POSIXct", "POSIXt")
print(num)
```

S3 系统有三个组成部分

- 属性attribute（尤其是class属性）

- 泛型函数generic function

- 方法method

## 8.2 属性

属性不影响对象实际取值，但作为某种类型的metadata，可以控制和管理这个对象。如数据框将行名和列名作为属性，还将其类 `data.frame` 作为属性。同样，可以使用 `attribute( )` 函数查看属性

```r
attributes(deck)
```

R提供了许多辅助函数，以设置和获取常见属性，如

```r
names(deck)
dim(deck)
class(deck)
row.names(deck)
levels(gender)
```

可以使用 `attr` 函数给对象添加任何属性，也可以查看所有属性，以老虎机一次输出为例

```r
one_play <- play()
one_play
attributes(one_play)
```

`attr`接受2参数：R对象 + 某属性名称（字符串形式），例如赋予 `one_play` 一个 `symbols` 属性

```r
attr(one_play, "symbols") <- c("B","0","B")
attributes(one_play)
attr(one_play,"symbols")
one_play
```

## 8.3 泛型函数

以 `print( )` 为例，其是泛型函数，可以在不同的场合完成不同的任务。例如，它可以根据对象的 `class` 属性，找到对应的输出方法，如之前提过的：

```r
num <- 1000000000
print(num)

class(num) <- c("POSIXct", "POSIXt")
print(num)
```

## 8.4 方法

在调用 `print` 函数时，它调用了特别的函数 `UseMethod`：

- `UseMethod` 检查提供给 `print` 函数的第一个参数的class属性

- 将提供的对象交给新函数处理，其专门针对不同class属性以作不同处理

例如，向 `print` 提供一个 `class == POSIXct` 的对象时，`UseMethod` 会将 `print` 函数所有参数交给 `print.POSIXct` 函数处理，返回针对该类的结果。`factor`同理

`print.POSIXct` 和 `print.factor` 成为 `print` 函数的**方法method**，会被`UseMethod` 调用并处理具有对应class属性的对象

综上：由泛型函数、方法和基于class的分派方式所构成的系统就是 R 的 S3系统，其起源于 S 语言的第三个版本。而**方法分派**，即为 `UseMethod` 根据Class（如`"factor"`），生成Generic Function（如`print`）的Method（如`print.factor`）的方式

## 8.5 类Class

创建类的方法：

- 其名称

- 给对象赋予 class 属性

- 写泛型函数的类方法

不过，编写类方法函数时，常有两个挑战：

- R将多个对象组合成向量时，会丢掉对象属性（如class属性）

- R对某对象取子集时，也会丢掉属性（如class属性）

## 8.6 小结

有了S3系统，在R中存储信息不止靠赋值，还可以靠 **赋予class属性**；创建特殊行为不止靠自定义函数，还可以靠 **赋予class属性以选择不同方法。**S3可以称为R的**面向对象编程**系统，该系统通过泛型函数来实现：泛型函数检查并输入对象的class属性，并针对性生成基于class属性的输出结果

# 9. 循环

## 9.1 expand.grid

R的`expand.grid`函数可以快捷写出 n 个向量元素的所有组合，如展示2个骰子的点数组合：

```r
die <- c(1:6)
rolls <- expand.grid(die, die)
```

`expand.grid` 返回的结果永远是数据框，且可据此轻松算出其他值，如

```r
rolls$value <- rolls$Var1 + rolls$Var2
head(rolls)
```

## 9.3 for循环

```r
for (i in 1:6){
  print(i)
}
```

其实，for循环主要用于将代码运行结果填入向量或列表：

```r
chars <- vector(length = 4)
words <- c(1:4)
for (i in 1:4){
  chars[i] = words[i]
}
chars
```

## 9.4 While循环

```r
plays_till_broke <- function(start_with){
  cash <- start_with
  n <- 0
  while(cash > 0){
    cash <- cash - 1 + play()
    n <- n + 1
  }
  n
}

plays_till_broke(200)
```

## 9.5 repeat循环

比While更低级，无条件重复循环
