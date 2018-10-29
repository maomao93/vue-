/* @flow */

/**
 * Expand input[v-model] with dyanmic type bindings into v-if-else chains
 * Turn this:
 *   <input v-model="data[type]" :type="type">
 * into this:
 *   <input v-if="type === 'checkbox'" type="checkbox" v-model="data[type]">
 *   <input v-else-if="type === 'radio'" type="radio" v-model="data[type]">
 *   <input v-else :type="type" v-model="data[type]">
 */

import {
  addRawAttr,
  getBindingAttr,
  getAndRemoveAttr
} from 'compiler/helpers'

import {
  processFor,
  processElement,
  addIfCondition,
  createASTElement
} from 'compiler/parser/index';
/*
  作用:
        1、标签名为input但不存在v-model属性时,结束该函数
        2、type属性存在不为空的值时,删除v-for属性信息
            1、获取该标签的v-if或v-else或v-else-if属性，并将这些属性信息在attrsMap和attrsList中删除
            2、attrsMap中添加type:checkbox和attrsList中添加{name:type,value:checkbox}
            3、对该标签描述对象进行key、ref、Slot、is、inline-template、css、style等等属性处理
            4、设置ASTElement对象的processed为true,表示已对上面的那些属性进行过处理了,避免重复处理
            5、设置ASTElement对象的if属性为(types属性值==='checkbox' && 原if属性值)
            6、在ASTElement对象的ifConditions数组中添加{exp: if属性值,block: ASTElement对象}
            7、克隆一份ASTElement对象为branch1,往attrsMap中添加type:checkbox和attrsList中添加{name:type,value:radio}
            8、在ASTElement对象的ifConditions数组中添加{exp: types属性值==='radio' && 原if属性值,block: branch1}
            9、克隆一份ASTElement对象为branch2,往branch2对象的attrsMap中添加:type:(:type属性值)和attrsList中添加{name:':type',value: 属性值}
            10、在ASTElement对象的ifConditions数组中添加{exp: 原if属性值,block: branch2}
            11、标签存在else属性时设置ASTElement对象的else属性为true否则标签存在elseif属性时设置ASTElement对象的elseif属性为标签的elseif属性值

      总结: 处理input标签并且存在v-model属性以及确定该input类型的表达式最后将该描述对象输出
*/
function preTransformNode(el: ASTElement, options: CompilerOptions) {
  //el: ast树对象  options: 开发者定义的option和默认的option合并过后的option

  //当标签名为input时
  if (el.tag === 'input') {
    //缓存key:val映射对象attrsMap
    const map = el.attrsMap
    //不存在v-model属性时终止函数执行
    if (!map['v-model']) {
      return
    }
    //创建typeBinding变量
    let typeBinding
    //当存在:type属性或者v-bind:type属性时
    if (map[':type'] || map['v-bind:type']) {
      //获取动态type属性值或静态type属性值或函数表达式
      typeBinding = getBindingAttr(el, 'type')
    }
    //没有设置静态属性type的值 && 不存在:type属性或者v-bind:type属性 && 存在v-bind属性时，获取v-bind属性值中的type属性赋值给typeBinding
    if (!map.type && !typeBinding && map['v-bind']) {
      typeBinding = `(${map['v-bind']}).type`
    }
    //typeBinding存在值时
    if (typeBinding) {
      //获取v-if的属性值并删除attrsMap和attrsList中该属性的信息(前提存在的该属性)
      const ifCondition = getAndRemoveAttr(el, 'v-if', true)
      //将ifCondition的值合并成字符串
      const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``
      //获取v-else的属性值并删除attrsMap和attrsList中该属性的信息(前提存在的该属性) 再判断值是否 != null
      const hasElse = getAndRemoveAttr(el, 'v-else', true) != null
      //获取v-else-if的属性值并删除attrsMap和attrsList中该属性的信息(前提存在的该属性)
      const elseIfCondition = getAndRemoveAttr(el, 'v-else-if', true)
      // 1. checkbox
      // 克隆一个AST树对象
      const branch0 = cloneASTElement(el)
      // process for on the main node
      //处理v-for属性值并在错误的写法时提示错误信息
      processFor(branch0)
      //往branch0对象的attrsMap中添加type:checkbox和attrsList中添加{name:type,value:checkbox}
      addRawAttr(branch0, 'type', 'checkbox')
      // 对该标签描述对象进行key、ref、Slot、is、inline-template、css、style等等属性处理
      processElement(branch0, options)
      // 标识为该标签已处理过
      branch0.processed = true // prevent it from double-processed
      // if属性设置为`(属性值) === checkbox&&`+ 原v-if的属性值
      branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra
      // 往el描述对象中添加ifConditions数组，并往数组中添加(包含if信息)的对象
      addIfCondition(branch0, {
        exp: branch0.if,
        block: branch0
      })
      // 2. add radio else-if condition
      // 克隆一份全新的el描述对象
      const branch1 = cloneASTElement(el)
      // 获取v-for属性值并从描述对象的attrList数组和attrsMap对象中删除该属性信息
      getAndRemoveAttr(branch1, 'v-for', true)
      // 往branch1对象的attrsMap中添加type:radio和attrsList中添加{name:'type',value:'radio'}
      addRawAttr(branch1, 'type', 'radio')
      // 对该标签描述对象进行key、ref、Slot、is、inline-template、css、style等等属性处理
      processElement(branch1, options)
      // 往branch0描述对象中的ifConditions数组中添加(判断是否为radio表达式)的对象
      addIfCondition(branch0, {
        exp: `(${typeBinding})==='radio'` + ifConditionExtra,
        block: branch1
      })
      // 3. other
      // 继续克隆一份el描述对象
      const branch2 = cloneASTElement(el)
      // 获取v-for属性值并从描述对象的attrList数组和attrsMap对象中删除该属性信息
      getAndRemoveAttr(branch2, 'v-for', true)
      // 往branch2对象的attrsMap中添加:type:(:type属性值)和attrsList中添加{name:':type',value: 属性值}
      addRawAttr(branch2, ':type', typeBinding)
      // 对该标签branch2描述对象进行key、ref、Slot、is、inline-template、css、style等等属性处理
      processElement(branch2, options)
      // 往branch0描述对象中的ifConditions数组中添加(包含if属性值)的对象
      addIfCondition(branch0, {
        exp: ifCondition,
        block: branch2
      })
      // 判断该input标签是否存在v-else属性
      if (hasElse) {
        //设置branch0描述对象的else属性为true
        branch0.else = true
        // v-else属性不存在，v-else-if属性存在并且不为空时
      } else if (elseIfCondition) {
        // 设置branch0描述对象的elseif属性为v-else-if属性值
        branch0.elseif = elseIfCondition
      }
      // 将branch0描述对象输出
      return branch0
    }
  }
}

//克隆一个AST树对象
function cloneASTElement(el) {
  return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}

export default {
  preTransformNode
}
