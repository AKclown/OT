### 前言

在上一篇[关于google docs的协同编辑](https://juejin.cn/user/2225067265099198/posts)我们理解了`google文档`的演进以及其是如何实现的，在最后一节中也涉及到了`Google Docs的协作协议`，它也就是`协同调度协议`。接下来来看看其中涉及到的`OT（操作转换）`，那么OT究竟是什么呢？ 接下来我们就来探讨一下



### 什么是OT

OT(操作转换 operation transform)是一种用于支持协作计算和应用程序的技术，OT具有丰富的协作功能并且已经支持广泛的应用程序。

OT支持一系列丰富的协作能力或功能:

1. **一致性维护或并发控制**： OT 能够保持共享文档的一致性，同时允许多用户自由并发地生成操作，并且系统能够快速响应本地用户并以不同的顺序执行远程操作
2. **冲突解决**：OT能够解决并发操作之间的冲突从而保持文档的一致性并且在冲突中保留所有操作的效果
3. **群组撤销(undo)**：OT支持多用户在并发编辑的环境下进行撤销(undo)操作
4. **空间感知**：OT能够支持复杂的工作区(例如2D/3D)等
5. **锁定**：OT 能够支持细粒度和响应式锁定，以帮助保护共享对象的完整性并维持协作计算环境中的语义维护

还有`操作通知`、`操作压缩`、`透明适配`等等



### 谁在使用OT构建协同应用

使用OT协同技术的应用有Google Docs、Google Wave、coPowerPoint、CoCKEditor、钉钉文档等等



### OT如何维护文档的一致性

接下来通过一个多用户协同编辑场景来说明`OT一致性维护的基本思想`：

![6](C:\Users\Administrator\Desktop\OT\6.png)

在这个场景中，两个客户端的初始文本都是`abc`，此时`AK`和`Clown同时更新各自本地的文档: 01= Ins [0, 'x']表示AK用户在文档0的位置插入字符串'x'，O2 = Del[2,1]表示Clown用户在文档位置为2的一个字符。 在OT操作控制下，本地操作将按照原样执行，远程操作将在执行前进行转换

**AK用户:**  首先执行O1将本地文档变为`xabc`, 然后接到O2并且与O1转换成O2' = T(O2，O1) = Del[3, 1]，O2的位置参数将`加1`以包含并发操作`O1`引起的一个字符插入的影响。执行O2'操作将文档`xabc`删除`c`从而最终文档变成`xab`，

**Clown用户:** 首先执行O2将本地文档变为`ab`, 然后接到O1并且与O2转换成O1' = T(O1，O2) = Ins[0, 'x']，转换后的O1‘与原始操作O1相同，因为先前执行的O2对O1没有影响。执行O1'操作将文档`ab`的起始0位置插入`x`从而生成最终文档  `xab`，与AK用户站点的文档内容保持一致



**OT一致性维护的基本思想:** 根据之前执行的并发操作效果，将一个编辑操作转换成新的形式，使得转换后的操作能够达到正确的效果，并且保证多站点文档一致性`T(远程操作，本地操作)`



### OT如何支持(非线性)撤销

接下来通过一个文本编辑场景来说明`OT支持(非线性)撤销的基本思想`：

![7](C:\Users\Administrator\Desktop\OT\7.png)

在这个场景中，两个客户端的初始文本都是`12`

1. 首先**Clown用户**执行`01 = Ins[2, 'y']`在文档位置2的地方插入字符串`y`，然后将O1广播至AK用户，最终两个用户文档状态为`12y`
2. 紧接着**AK用户**基于上一步的文档状态执行`O2 = Ins[0, 'x']`在文档位置0的地方插入字符串`x`,然后将O2广播至Clown用户，最终两个文档状态为`x12y`
3. 在执行完O1和O2操作之后，**Clown用户发出撤销命令Undo(O1)来撤销O1**而不是`最后执行的操作O2`(因为撤销只能撤销自己的操作，不能撤销其他客户端的操作)。基于OT的撤销系统将创建`O1的逆操作` !O1 = Inverse(O1 = Insert[2,“y”]) = Delete[2]，然后针对O2操作对!O1进行操作转换!O1’ = T(!O1, *O*2) = *Delete*[3]，最后在执行!O1’ ，最终删除文档3位置的字符串`y`从而得到正确的文档状态`x12`。



**OT支持(非线性)撤销的基本思想：** 首先基于OT撤销系统创建O的逆操作O‘ = Inverse(O）,再根据O转换执行的操作效果将O’(待撤销操作)转换为新的形式，以使转换后的逆操作能够实现正确的撤销效果。正确的撤销效果会撤销O的效果，但保留其他操作的效果

 

### OT对于操作压缩的基本思路

接下来通过一个文本编辑场景来说明`OT对于操作压缩的基本思路`：

![8](C:\Users\Administrator\Desktop\OT\8.png)

在这个场景中，两个客户端的初始文本都是`12`

首先**AK用户**按顺序执行如下四个步骤: `O1 = Ins[2, 'x']`、`O2 = Ins[1, 'abc']`、`O3 = Ins[2, 'y']`、`O4 = Del[7]`，假设这些操作都记录在L = [O1, O2, O3, O4]中而不会立即执行上传(这可能发生在实时或非实时协同会话中)。在上传之前，可以使用`基于OT的压缩算法压缩L中的操作`，该算法从`末尾(最右)到开头(最左)`逐一扫描L中的操作，检查每个相邻操作之间的关系，是否可以对其进行`转置`、`消除`、`合并`

1. 最右侧的O4与相邻的O3进行转置：transpose(O3, O4) = [O4' , O3‘] ，此时O4'为Del[6] 且 O3' = O3， 最终结果为`[ O1 ,O2, O4', O3]`
2. O4'对新的相邻操作O2进一步的转置: transpose(O2, O4‘) = [O4'’ , O2‘‘] ，此时O4'为Del[3] 且 O2' = O2， 最终结果为`[ O1 ,O4'', O2, O3]`
3. 检查O4''的新的相邻操作O1，发现他们位置重叠且操作互补(对文档没有影响)。因此O4''和O1将从L中移除，最终结果为`[O2, O3]`
4. 在L’中O3与相邻操作O2重叠，因此对它们进行合并O2' = Ins [1, 'aYbc']结果为L‘ = [O2']
5. 最终将`L‘ = [O2']`代替`L = [O1, O2, O3, O4]`发送至远程



**OT对于操作压缩的基本思路：** 通过对`累积的操作`逐一扫描`[末尾(最右)到开头(最左)]`以检查它们的重叠和互补关系，来决定是否采用`转置`、`消除`、`合并`进而实现操作压缩效果。在保留L原有的操作效果同时减少L的操作步骤数量(有利于带宽传输和减少远端的操作步骤处理)



### OT系统结构设计

构建OT系统的一种既定策略，是将高级的`transform control`算法与低级的`transform function`分离，并将这两层之间的关系(职责和约束)指定为OT系统中间`transform properties and conditions`

![image-20250514111414993](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20250514111414993.png)

**转换控制算法**：负责确定何时将操作(转换目标)进行转换，应针对那些操作进行转换以及按照那种顺序进行转换

**转换函数**：负责参考操作的影响对目标操作进行实际的转换

**转换属性与条件**：定义**控制算法**与**转换函数**之间的关系，作为OT算法正确性的要求



### 基于OT实现协同应用

理解了基础的OT相关知识之后，接下来基于`协同调度协议`+`OT算法`来实现一个简单协同应用，这里选择`react`+`nestjs`来实现。

![ot-text1](C:\Users\Administrator\Desktop\OT\ot-text1.gif)

先来看看demo演示示例，在本地我有两个客户端文档， 

1. 首先按顺序分别在`1客户端`输入字符串`1`，在`2客户端`输入`23`, 没有任何冲突两端保持同步。

2. 将`2客户端`断网（也就无法将改动推送到服务器中），然后以`客户端2`的文本在`3的位置插入字符串4`，在`0的位置插入字符串5`。
3. 打开`1客户端`(网络正常)，在`3的位置插入字符串6`（这里的插入的字符位置3和2客户端有冲突）
4. 打开`2客户端`的网络进行同步。两端显示数据保持了一致性。

`1客户端在第三步骤插入的字符6`和`2客户端第二步骤插入的字符4`的位置产生了冲突，因为`1客户端的changes`先到达服务器会先进行合并，紧接着`2客户端插入的字符4`到达服务器此时就需要进行`OT转换`将`插入的位置从3改为4`在派发给`1客户端`。另外`1客户端插入6的changes`在到达`2客户端`时，因为`2客户端在位置0插入了字符5`影响到`1客户端的changes`，因此需要进行`OT转换`，将`{type:insert, position:3, text:'6'}`转换为`{position:4, ...}`在合并到`2客户端`的本地代码

![5f620195-0854-4a7a-848b-8a0cebdbe1a1](C:\Users\Administrator\Desktop\OT\5f620195-0854-4a7a-848b-8a0cebdbe1a1.png)

### 基础的OT算法

下面是上述demo使用的服务端的OT算法，包含了`insert`和`delete`两种OT的操作类型，当然这不全面，例如你可以追加`replace(替换操作类型)`、`style(样式操作类型)`等等，然后基于类型去修改这个`OT转换算法即可`，该算法非常简单，主要为了演示demo使用

推荐可以看看codemirror的[collab源码](https://github.com/codemirror/collab#readme)

```
  private transformAgainst(
    incomingOp: Operation,
    pendingOp: Operation,
  ): Operation[] {
    // $ 基础的OT算法逻辑(文本编辑器)
    // $ 这只是一个简易版本、实际会更加复杂点
    if (incomingOp.position < pendingOp.position) {
      // 在先前changes的前面插入
      if (incomingOp.type === 'insert' && pendingOp.type === 'insert') {
        return [incomingOp];
      } else if (incomingOp.type === 'insert' && pendingOp.type === 'delete') {
        return [incomingOp];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'insert') {
        return [incomingOp];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'delete') {
        if (incomingOp.position + incomingOp.length! <= pendingOp.position) {
          // $ 非重叠删除
          return [incomingOp];
        } else {
          // $ 重叠删除
          if (
            incomingOp.position + incomingOp.length! >=
            pendingOp.position + pendingOp.length!
          ) {
            // 全部重叠
            const startLen = pendingOp.position - incomingOp.position;
            const endLen =
              incomingOp.position +
              incomingOp.length! -
              (pendingOp.position + pendingOp.length!);

            return [
              {
                ...incomingOp,
                length: startLen + endLen,
              },
            ];
          } else {
            // 部分重叠
            return [
              {
                ...incomingOp,
                length: pendingOp.position - incomingOp.position,
              },
            ];
          }
        }
      }
    } else if (incomingOp.position > pendingOp.position) {
      // 在先前changes的后面插入
      if (incomingOp.type === 'insert' && pendingOp.type === 'insert') {
        return [
          {
            ...incomingOp,
            position: incomingOp.position + pendingOp.text!.length,
          },
        ];
      } else if (incomingOp.type === 'insert' && pendingOp.type === 'delete') {
        return [
          { ...incomingOp, position: incomingOp.position - pendingOp.length! },
        ];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'insert') {
        return [
          {
            ...incomingOp,
            position: incomingOp.position + pendingOp.text!.length,
          },
        ];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'delete') {
        if (pendingOp.position + pendingOp.length! <= incomingOp.position) {
          // $ 非重叠删除
          return [
            {
              ...incomingOp,
              position: incomingOp.position - pendingOp.length!,
            },
          ];
        } else {
          // $ 重叠删除
          if (
            pendingOp.position + pendingOp.length! >=
            incomingOp.position + incomingOp.length!
          ) {
            // 全部重叠 (空操作)
            return [
              {
                ...incomingOp,
                length: 0,
              },
            ];
          } else {
            // 部分重叠
            return [
              {
                ...incomingOp,
                position: pendingOp.position,
                length:
                  incomingOp.position +
                  incomingOp.length! -
                  (pendingOp.position + pendingOp.length!),
              },
            ];
          }
        }
      }
    } else {
      // 与先前changes的相同的位置
      if (incomingOp.type === 'insert' && pendingOp.type === 'insert') {
        // 版本靠后的往后挪
        return [
          {
            ...incomingOp,
            position: incomingOp.position + pendingOp.text!.length,
          },
        ];
      } else if (incomingOp.type === 'insert' && pendingOp.type === 'delete') {
        return [
          {
            ...incomingOp,
            position: incomingOp.position - pendingOp.length!,
          },
        ];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'insert') {
        return [
          {
            ...incomingOp,
            position: incomingOp.position + pendingOp.text!.length,
          },
        ];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'delete') {
        if (pendingOp.length === 0) {
          // 表示没有删除字符
          return [incomingOp];
        } else {
          // 重叠删除
          if (
            pendingOp.position + pendingOp.length! >=
            incomingOp.position + incomingOp.length!
          ) {
            // 全部重叠 (空操作)
            return [
              {
                ...incomingOp,
                length: 0,
              },
            ];
          } else {
            // 部分重叠
            return [
              {
                ...incomingOp,
                length: incomingOp.length! - pendingOp.length!,
              },
            ];
          }
        }
      }
    }

    return [incomingOp];
  }

```



### 总结

在这一章中我们了解了,`什么是OT`以及结合`上一章涉及到的协同调度协议`实现了一个`OT文本编辑器的demo`，此次代码涉及到的[源码](https://github.com/AKclown/OT)，此次demo由于时间关系写的非常粗糙，例如`OT历史回退`、`changes的合并`、`本地版本和服务器版本不一致的处理`、`网络断线重连`等都没有涉及，但是只要我们弄清楚了**`协同的调度协议`和`OT操作转换`**我们就可以搭建一套属于我们自己的`协同应用`，这些指的`协同应用`不一定是指`文本编辑器`，他也可以是`低代码平台`等应用的实现。下一篇是`crdt与yjs的探讨`，祝大家万事如意

**关于协同应用最最最重要的核心点：`协同的调度协议`和`OT操作转换` **



### PS:

这里推荐阅读[Design a Collaborative Editing System like Google Docs](https://systemdesignschool.io/problems/google-doc/solution)学习系统化思维去分析一个需求。

依稀记得前年面试被`阿里大佬`问`拿到一个需求时，应该怎么做`、`客户反馈首页加载速度慢，你会怎么做`、`关于编辑器的回放如何设计与实现`。之前我的上来就是`应用实现`而`没有对需求具备系统化和模块化的思维`

```
客户反馈首页加载速度慢，你会怎么做
1. 分析首屏慢的问题
2. 指标有哪些
3. 具体是什么慢
4. 个别用户还是平均用户
5. 目标是什么(比如80% 降到20%..)
6. 分析要点  网络/渲染，分清接口还是渲染等等
7. 落地 (方案的才去，例如网络缓存... 体积优化等等)
8. 修改完成之后如何确定以及优化完成，等等

拿到一个需求时，应该怎么做
1. 最主要是经验
2. 以用户为中心，为用户带来什么价值(不能产品说这么做就这么做)
3. 用户的需求是什么，产品指定的方案是什么，以及方案的可行性
4. 技术的可行性、功能的性能、工程的能力
5. 如何规划项目的进度（前后端如何协调、何时进行沟通、功能上的对接等等）
6. 落地实施

拿到一个需求，要了解清楚客户的诉求是什么、方案调研、方案的选项、技术的可行性、对项目制定规范等

如何实现回放功能（需求分析 -> 再到方案选择 -> 落地）

回放分为几种方案：
1.每一个时间阶段截图上传HTMLTOIMG (图片形式)
2.chrome有视频分享  （视频的形式）
3. observe api实现  （dom变化的形式）
4. 数据驱动  （state的变化..）

然后再讲为什么选择这个方案，以及方案如何实现的等等
```



### 参考文献

[Design a Collaborative Editing System like Google Docs](https://systemdesignschool.io/problems/google-doc/solution)

[Operational Transformation Frequently Asked Questions and Answers](https://www3.ntu.edu.sg/scse/staff/czsun/projects/otfaq/#_Toc321146126)

[Google Docs Architecture: Real-Time Collaboration with OT vs. CRDTs](https://sderay.com/google-docs-architecture-real-time-collaboration/)
