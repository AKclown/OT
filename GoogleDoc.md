### 旧版本Google Docs协作

[旧版本的Goole Docs](https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs_21.html)和许多其他协作文档处理器采用的是`文档版本比较`机制。假设现在有两个编辑用户AK和clown(两个客户端都已经同步到最新的服务端文档状态)。当服务端接收到AK文档更新，服务端会找其版本与AK版本之间的差异，并且确定如何尽可能的合并这两个版本。然后服务端再把合并之后的版本更新发送至clown客户端，如果clown存在未发送给服务端的变更版本，那么他需要做`服务端版本和本地版本的比较`以及`合并两个版本`,然后clown再将合并后的本地版本推送到服务端，反复执行即可



但`通常这种方式实现的效果不佳`，请看如下例子。AK、clown和服务器起始文本为`The quick brown fox`,AK加粗`brown fox`同时clown将单词`fox`改为`dog`。假设AK的更改操作先到达服务器然后服务端再把该更改发送至clown

![7fe955b2-1679-4645-8f44-c543d3dc2671](C:\Users\Administrator\Desktop\OT\7fe955b2-1679-4645-8f44-c543d3dc2671.png)

上述AK和clown正确的合并答案为The quick **brown dog**。由于合并算法没有足够的信息进行正确合并，因此下面三种情况都是合理的“The quick **brown fox** dog”、“The quick **brown** dog”、“The quick **brown** dog **fox”**。

问题也出在这里: `如果只是比较文档版本，就无法确保更改的合并符合编辑者的预期`因此我们需要抛弃这种方案。

我们也可以对编辑器引入更多的限制来避免合并问题，例如，`追加锁段落`以便同一时间只允许一个编辑器编辑一个段落，但是这违背了协同编辑的原始需求，体验层面也要大个差。

### 新版的Google Doc的协作

从上一节我们了解了单纯靠`文档版本比较`机制，会出现`由于没有足够的操作信息`导致无法正确的合并更改。因此新版的Google Doc采用了另外一种方式: `将文档存储为一系列按时间排序的操作更改(operate)`。operate类似于`insert [10, 'T']`标识在文档的位置10插入字符串`T`。新旧Google doc的区别在于: `不再是通过比较文档版本来计算更改，而是通过向前推进operate的历史来计算更改`。这种方式使得编辑者的意图变得清晰，由于我们知道每一项的修订版本，我们可以检查编辑者在进行该变更时看到的内容，并找出如何正确地将该变更与此后所做的任何变更合并



将文档的历史视为一系列的`changes`，在Google Doc中所有的`changes`归结于三种基础类型:

1. inserting text (插入文本)
2. deleting text (删除文本)
3. applying styles (更新样式)

当然`changes`类型可以根据自己的`编辑器能力`进行扩展，例如`update text[0-5，‘hello’] 替换位置0-5为hello`等

![16226064-a5ca-4e91-9e88-dbeb83cd5a41](C:\Users\Administrator\Desktop\OT\16226064-a5ca-4e91-9e88-dbeb83cd5a41.png)



当我们编辑文档时，所有的changes都会以这三种之一的形式追加到文档的修订日志中，当我们打开文档时，文档会从头开始重播这些修订日志直至最新 (可以理解为回放功能，例如起始文档为A，经过B、C的cahnges得到最终D，那么我们知道了起始文档状态A，修订日志也记录了更新过程B、C，是不是最终通过重播我们也就能得到D呢？)

![0cab61d4-4880-44bb-b80d-8de03b78d501](C:\Users\Administrator\Desktop\OT\0cab61d4-4880-44bb-b80d-8de03b78d501.png)

接下来看一个例子:

假设AK和clown编辑文档的最初状态为: `easy as 123` 。如果AK将文档变更为`easy as ABC`，那么AK的更改分解为如下四步骤:

![28982d18-ed10-4ec2-b67d-fa659a817aab](C:\Users\Administrator\Desktop\OT\28982d18-ed10-4ec2-b67d-fa659a817aab.png)

在同一时间clown用户在文档的0-1位置添加了`it`字符串

![6f6c7df9-d1d4-4f3f-a6e3-fc72d325ae9b](C:\Users\Administrator\Desktop\OT\6f6c7df9-d1d4-4f3f-a6e3-fc72d325ae9b.png)

假设AK的`del [8-10]`操作被clown直接应用了，那么会删除错误的字符串`s 1`而不是`123`。

![208a4004-1788-4687-a4ce-99ef3c418fbe](C:\Users\Administrator\Desktop\OT\208a4004-1788-4687-a4ce-99ef3c418fbe.png)

原因是：因为`ak`的本地文档跟`clown`的本地文档版本不一致，因此需要转换`del [8-10]操作`使其相对于clown的本地文档。在这种情况下，当clown收到了AK的`更改操作`时，该更改操作需要知道向后`移动两个字符`以适应clown在0-1添加`it`字符。这里的转换算法就是`OT（操作转换）`。文档的中的OT逻辑必须要处理当前文档下 changes的所有操作类型，例如`insertText`、`deleteText`、`applyText`每一种类型操作转换方式都有所不同

![09eba89a-a108-4c2a-915f-ac610a0f0f37](C:\Users\Administrator\Desktop\OT\09eba89a-a108-4c2a-915f-ac610a0f0f37.png)

通过OT转换将他人的changes转换为符合自身本地的changes并应用到本地，最终就实现了所有编辑者的文档最终保持一致。



`当changes类型之间不冲突则无需进行OT转换`，假设AK给文档字符串进行加粗applyText [bold, 0-10]，而clown给文档字符串设置字体颜色为红色applyText [font-color=red, 0-10]，虽然范围都是0到10但是`两种操作并不冲突因此无需转换`，直接应用即可

![image-20250517190432608](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20250517190432608.png)

Google docs协作将changes从编辑者发送到服务器中，然后再通过服务区广播给`在线的其他编辑者`，每个编辑者会通过`OT算法`转换传入changes，使该changes符合本地文档版本



### Google Docs协作协议的工作原理

### Google Docs的协作协议

下面来详细了解一下Google Docs协作协议的工作原理

**每个客户端维护如下信息**

1. 最后同步修订(id)
2. 所有尚未发送到服务器的本地更改(待处理的更改)
3. 所有本地更改已发送到服务器`但尚未被确认`(已发送更改)
4. 当前文档状态对用户可见

**中央服务端维护如下信息**

1. 所有已收到但尚未处理的更改列表(待处理的更改)
2. 所有已处理变更的日志(修订日志)
3. 上次处理变更时文档的状态



接下来通过一个例子来描述协作的工作原理，假设现在有`AK`、`clown`两个用户在一个`空文档`开始协同编辑文档



用户`AK`在文档0的位置插入字符串`hello`，此更改会被加入到`本地待处理更改`的队列中，然后再发送到`服务端`，服务端接收这一次操作将该操作信息(上一次同步修订号、客户端的唯一标识、操作的数据信息)加入到`服务端待处理的队列中`也将此更改移至`已发送更改`的队列中。

![1](C:\Users\Administrator\Desktop\OT\1.png)

紧接着，客户端AK输出“world”与此同时客户端clown在他的空文档中输入“！”（因为此时的客户端clown还没有接收到AK的改动因此文档为空）

客户端AK插入在文档5的位置添加"world"字符串，此更改会被添加到`待更新的队列`中但还未发送到服务端中，因为AK客户端`上一次的更改尚未得到确定`并且我们`一次只能发送一次更改`。另外服务端已处理AK的第一次更改操作将其移至修订日志中，以及clown客户端在空文档插入`!`字符串，该操作会被添加到clown客户端的`待更新队列中`并且该操作未发送到服务端中。

![2](C:\Users\Administrator\Desktop\OT\2.png)

服务端处理了客户端AK的第一次更改并将其移至修订日志中，然后服务端将向客户端`AK`发送确定事件，并且将客户端AK的更改通过广播的形式同步到客户端clown中。

![3](C:\Users\Administrator\Desktop\OT\3.png)

客户端clown收到客户端AK的`更改操作`并对此更改应用`转换函数`,通过`OT转换函数`将待处理更改中的字符串`!`索引从0移至到5。同时AK和clown都将`最后同步修订更新为1`，客户端AK将`已发送的队列`中删除了第一次的更改操作



接下来， AK 和 clown同时将`未发送的更改`发送到服务器中

![4](C:\Users\Administrator\Desktop\OT\4.png)

服务端先接收到AK的变更，因此会优先对其进行处理以及向AK发送确定事件，并且会将AK的变更操作发送至clown客户端中，clown在使用OT转换函数对本地变更进行转换将其本地的变更索引移至11的位置

接下来是一个重要的时刻，服务端开始处理clown的更改操作，但是由于clown的修订版本ID已经过期了(实际为2，现在为1)，服务端会根据clown`尚未知晓的所有更改操作`(这里即为AK更改操作 insert [5， ‘world’])，通过`OT转换函数`来转换他的更改，并将`其保存为修订版本2`

![5](C:\Users\Administrator\Desktop\OT\5.png)





### 实现一个简单的OT协同应用































