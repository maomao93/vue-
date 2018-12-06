/*
  解析成的ast树,动态属性值都是''，非动态属性值都是'""'
*/
let ast = {
  type: 1,//节点类型(1、2、3)
  expresssion: "'我是'+_s(name)+'?'",//文本节点中存在字面表达式
  tokens: ['我是',{
    '@binding': '_(name)'
  },'?'],//给weex用的
  tag: 'div',//标签名
  attrsList: [
    {
      name: 'v-for',
      value: '(value,key,index) in lists'
    }
  ],//属性列表
  attrsMap: {
    'v-for': '(value,key,index) in lists'
  },//属性列表对象形式
  attrs: [
    {name: 'v-for', value: '(value,key,index) in lists'},
    {name: 'id',value: '"app"'},
    {name: 'slot',value: 'header'}
  ],//非原生属性  会使用原生DOM操作方法setAttribute真正将属性设置给DOM元素
  Props: [
    {name: 'innerHTML',value: '“some text”'},//在动态属性后面存在prop修饰符 比如: v-bind:innerHTML
    {name: 'value',value: 'valueData'}, //类型不为button的input
    {name: 'selected', value: 'optionData'},// 标签为option的selected属性
    {name: 'checked', value: 'checkedData'}, //多选input
    {name: 'muted', value: 'mutedData'},// video标签的muted属性
    /*以上都有v-bind:前缀,也就是动态的*/
    {name: 'muted', value: 'mutedData'}// video标签的muted属性
    /*静态属性除了video标签的muted属性，其他都放在attrs中*/
  ],//原生属性
  pre: true,//存在v-pre指令
  ns: 'svg' || 'math',//只有svg标签和math标签才有 为了解决IE兼容问题
  forbidden: true,//标签为style || 类型为空或不为'text/javascript'的script标签
  parent: ast,//父元素的ast树对象引用
  children: [ast,ast],//子元素的ast树对象引用
  ifConditions: [
    {exp: 'v-if属性值',block: ast},//当前节点ast树的引用
    {exp: 'v-else-if属性值', block: ast},//存在v-else-if属性值节点的ast树引用
    {exp: 'v-else属性值', block: ast},//存在v-else属性值节点的ast树引用
  ],//存在v-else-if或v-else的节点信息会放入存在v-if的兄弟节点的ifConditions数组中
  if: 'a',//v-if属性值
  elseif: 'b',//v-else-if属性值
  else: 'c',//v-else属性值
  slotName: '"header"',//只有slot标签会有
  slotTarget: '"header"' || '"default"',//存在slot属性的标签,除了slot标签
  slotScope: '{item}',//存在slot-scope属性
  slot: '"header"',//标签名不为template && 不存在slot-scope属性
  scopedSlots: {
    "header": ast,
    "default": ast,
  },//存在slot-scope属性的标签AST树的引用
  once: true,//存在v-one指令
  key: '"unique"',//key属性
  ref: '"table"',//ref属性值,
  refInFor: true,//该标签存在ref属性&&其父元素或自身存在v-for指令
  component: 'currentView',//存在is属性
  inlineTemplate: true,//存在inline-template属性,表示将该节点变成该父组件的模板(也就是当成template)
  hasBindings: true,//存在v-、@、:的属性名
  events: {
    '!click': {
      value: 'handleClick',
      modifiers: {}
    },//capture修饰符
    '~click': {
      value: 'handleClick',
      modifiers: {}
    },//once修饰符
    '&click': {
      value: 'handleClick',
      modifiers: {}
    },//passive修饰符
    /*以上适用于任何事件名,修饰符叠加前缀也叠加*/
    'contextmenu': {
      value: 'handleClick',
      modifiers: {}
    },//right修饰符
    'mouseup': {
      value: 'handleClick',
      modifiers: {}
    },//middle修饰符
    /*以上只对于click事件*/
    'update:count': {
      value: 'addCount=$event' || '$set表达式',
      modifiers: {}
    },//:count.sync="addCount",存在sync修饰符的，只存在于events中
  },//事件不存在native修饰符
  nativeEvents: events,//事件存在native修饰符
  directives: [
    {name: 'model',rawName: 'v-model',value: 'modelData',arg: 'foo',modifiers:{a: true, b: true}},//比如:v-model:foo.a.b=""
    {name: 'if',rawName: 'v-if',value: 'ifData',arg: 'foo',modifiers:{a: true, b: true}},//比如:v-if:foo.a.b=""
  ],//v-if、v-else-if、v-else、v-once、v-text、v-html、v-model、v-for、v-pre、v-cloak、v-show等等以及自定义的指令
  staticStyle: '{"color":"red","background":"green"}',//静态样式
  styleBinding: '{ backgroundColor: green }',//动态样式
  staticClass: '"a b c"',//静态class
  classBinding: '{ a: true }',//动态class
  plain: true,//1、没有任何属性(包括静态和动态)(前提子元素不存在slot-scope属性)
  isComment: true,//注释内容
  //以下是优化过后才有的
  static: true,
    /*包括兄弟元素
      1、静态文本节点
      2、存在v-pre属性的
      3、不存在任何指令属性&&离其最近的祖元素是html保留标签&&存在静态class和style&&组元素不存在v-for指令.
      4、子元素的AST树对象的static也是true(非html保留标签&&不存在inline-template属性时,下面的子孙元素的ast树不存该属性)
      总结: 不会变化的
    */
  staticInFor: true,
    /*  前提:标签类型为1,不为则没有这个属性(包括兄弟元素)
        1、(static属性为true || 存在v-once指令) && 不为根标签 && 祖节点存在v-for指令
        2、static属性为true &&(子元素长度大于0 || 子元素只有一个但是类型不为3)的子孙元素  的不存在该属性
            1、子孙元素不会变化的 || 子孙不纯但是该标签存在v-once&&父元素存在v-for指令
    */
  staticRoot: true,
  /*前提: 标签类型为1
        1、static属性为true &&(子元素长度大于0(类型不为2) || 子元素只有一个但是类型为1)的元素(其子元素不存在该属性)
            <div (class=xx style=xx) || v-pre>
              <div (class=xx style=xx) || v-pre></div>
            </div>
  */
}
