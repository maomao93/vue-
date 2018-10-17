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
} from 'compiler/parser/index'

function preTransformNode (el: ASTElement, options: CompilerOptions) {
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
      //往branch0对象的attrsMap中添加type:checkbox和attrsList中添加{type:type,checkbox:checkbox}
      addRawAttr(branch0, 'type', 'checkbox')
      processElement(branch0, options)
      branch0.processed = true // prevent it from double-processed
      branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra
      addIfCondition(branch0, {
        exp: branch0.if,
        block: branch0
      })
      // 2. add radio else-if condition
      const branch1 = cloneASTElement(el)
      getAndRemoveAttr(branch1, 'v-for', true)
      addRawAttr(branch1, 'type', 'radio')
      processElement(branch1, options)
      addIfCondition(branch0, {
        exp: `(${typeBinding})==='radio'` + ifConditionExtra,
        block: branch1
      })
      // 3. other
      const branch2 = cloneASTElement(el)
      getAndRemoveAttr(branch2, 'v-for', true)
      addRawAttr(branch2, ':type', typeBinding)
      processElement(branch2, options)
      addIfCondition(branch0, {
        exp: ifCondition,
        block: branch2
      })

      if (hasElse) {
        branch0.else = true
      } else if (elseIfCondition) {
        branch0.elseif = elseIfCondition
      }

      return branch0
    }
  }
}

//克隆一个AST树对象
function cloneASTElement (el) {
  return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}

export default {
  preTransformNode
}
