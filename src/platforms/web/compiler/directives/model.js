/* @flow */

import config from 'core/config'
import { addHandler, addProp, getBindingAttr } from 'compiler/helpers'
import { genComponentModel, genAssignmentCode } from 'compiler/directives/model'

let warn

// in some cases, the event used has to be determined at runtime
// so we used some reserved tokens during compile.
export const RANGE_TOKEN = '__r'
export const CHECKBOX_RADIO_TOKEN = '__c'
/*
  作用:
        1、处理v-model指令
        2、处理存在is属性的component组件的v-model              return false
        3、处理select的v-model                                return true
        4、处理标签为input && 类型为多选的v-model              return true
        5、处理标签为input && 类型为单选的v-model              return true
        6、处理其他类型的input || textarea 的v-model          return true
        7、处理用户自定义组件的v-model                        return false
        8、非以上标签使用v-model提示并收集错误信息‘不支持此元素类型上的v-model’  return true
*/
export default function model (
  el: ASTElement, // 节点信息
  dir: ASTDirective, // 指令信息
  _warn: Function // 收集警告函数
): ?boolean {
  // 缓存警告函数
  warn = _warn
  // 缓存指令值
  const value = dir.value
  // 缓存指令修饰符
  const modifiers = dir.modifiers
  // 缓存标签名
  const tag = el.tag
  // 缓存节点的type属性值
  const type = el.attrsMap.type
  // 在非生产环境下&&标签名为input类型为file则收集警告信息
  if (process.env.NODE_ENV !== 'production') {
    // inputs with type="file" are read only and setting the input's
    // value will throw an error.
    // 如果标签名为input类型为file则收集警告信息'文件输入是只读的。使用v-on:change侦听器。'
    if (tag === 'input' && type === 'file') {
      warn(
        `<${el.tag} v-model="${value}" type="file">:\n` +
        `File inputs are read only. Use a v-on:change listener instead.`
      )
    }
  }
  // 存在is属性
  if (el.component) {
    // 处理组件的v-model属性并返回false结束该函数
    genComponentModel(el, value, modifiers)
    // component v-model doesn't need extra runtime
    return false
    // 标签为select
  } else if (tag === 'select') {
    // 解析select节点的v-model并输出相应的字符串代码
    genSelect(el, value, modifiers)
    // 标签为input && 类型为多选框
  } else if (tag === 'input' && type === 'checkbox') {
    // 解析多选框的v-model
    genCheckboxModel(el, value, modifiers)
    // 标签为input && 类型为单选框
  } else if (tag === 'input' && type === 'radio') {
    // 解析单选框的v-model
    genRadioModel(el, value, modifiers)
    // 标签为input || 标签为textarea
  } else if (tag === 'input' || tag === 'textarea') {
    // 解析textarea || input的v-model
    genDefaultModel(el, value, modifiers)
    // 标签不为html保留字段和svg标签字段(也就是用户自定义的组件)
  } else if (!config.isReservedTag(tag)) {
    // 处理自定义组件的v-model属性,并为el添加model属性信息对象,然后结束该函数
    genComponentModel(el, value, modifiers)
    // component v-model doesn't need extra runtime
    return false
    // 不满足以上条件&&在非生产环境下 收集错误信息'不支持此元素类型上的v-model'
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `<${el.tag} v-model="${value}">: ` +
      `v-model is not supported on this element type. ` +
      'If you are working with contenteditable, it\'s recommended to ' +
      'wrap a library dedicated for that purpose inside a custom component.'
    )
  }

  // ensure runtime directive metadata
  return true
}
/*
  作用:
        1、解析多选框checkbox的v-model
        2、往el的props数组中添加checked属性信息对象
        3、为el的events对象中添加change事件信息对象
*/
function genCheckboxModel (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
) {
  // 存在修饰符 && 确定number修饰符是否存在
  const number = modifiers && modifiers.number
  // 获取value属性值,不存在则缓存'null'
  const valueBinding = getBindingAttr(el, 'value') || 'null'
  // 获取true-value属性值,不存在则缓存'true'
  const trueValueBinding = getBindingAttr(el, 'true-value') || 'true'
  // 获取false-value属性值,不存在则缓存'false'
  const falseValueBinding = getBindingAttr(el, 'false-value') || 'false'
  // 往el的props数组中添加checked属性信息对象,属性值为一段字符串代码
  // 该代码作用: 判断v-model属性值变量是否为数组?
  // 是: _i(v-model属性值变量,value属性值 || 'null')>1
  // 否: true-value属性不存在? (v-model属性值变量) : -q(v-model属性值变量,true-value属性值)
  addProp(el, 'checked',
    `Array.isArray(${value})` +
    `?_i(${value},${valueBinding})>-1` +
    (
      trueValueBinding === 'true'
        ? `:(${value})`
        : `:_q(${value},${trueValueBinding})`
    )
  )
  // 为el的events对象中添加change事件信息对象{value: 字符串代码}
  // 该字符串代码作用: $$a = v-model属性值变量, $$el = checkbox节点信息, $$c = 选中?(true-value属性值 || 'true') : (false-value属性值 || 'false')
  // v-model属性值变量为数组时:
  //    $$v = number修饰符是否存在? '_n(value属性值)':value属性值, $$i = _i($$a,$$v);
  //    当该节点选中时,$$i<0 && 设置v-model属性值变量的值为$$a.concat([$$v])
  //    未选中时, $$i>-1 && 设置v-model属性值变量的值为$$a.slice(0,$$i).concat($$a.slice($$i+1))
  // 不为数组时: 设置v-model属性值变量的值为$$c
  addHandler(el, 'change',
    `var $$a=${value},` +
        '$$el=$event.target,' +
        `$$c=$$el.checked?(${trueValueBinding}):(${falseValueBinding});` +
    'if(Array.isArray($$a)){' +
      `var $$v=${number ? '_n(' + valueBinding + ')' : valueBinding},` +
          '$$i=_i($$a,$$v);' +
      `if($$el.checked){$$i<0&&(${genAssignmentCode(value, '$$a.concat([$$v])')})}` +
      `else{$$i>-1&&(${genAssignmentCode(value, '$$a.slice(0,$$i).concat($$a.slice($$i+1))')})}` +
    `}else{${genAssignmentCode(value, '$$c')}}`,
    null, true
  )
}
/*
    作用:
         1、解析单选框radio的v-model
         2、往el的props数组中添加checked属性信息对象
         3、为el的events对象中添加change事件信息对象
*/
function genRadioModel (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
) {
  // 存在修饰符 && 确定number修饰符是否存在
  const number = modifiers && modifiers.number
  // 缓存value属性值，不存在则缓存'null'
  let valueBinding = getBindingAttr(el, 'value') || 'null'
  // 存在number修饰符? _n(value属性值 || 'null') : (value属性值 || 'null')
  valueBinding = number ? `_n(${valueBinding})` : valueBinding
  // 往el的props数组中添加checked属性信息对象,属性值为一段字符串代码: _q(v-model属性值变量,value属性值 || 'null')
  addProp(el, 'checked', `_q(${value},${valueBinding})`)
  // 为el的events对象中添加change事件信息对象{value: 字符串代码},字符串代码的作用: 设置v-model属性值变量的值为(value属性值 || 'null')
  addHandler(el, 'change', genAssignmentCode(value, valueBinding), null, true)
}
/*
    作用:
          1、解析select标签的v-model
          2、为el添加change事件信息对象,并且对象中的value属性
             为(一段设置select节点v-model属性值变量为select选中的值集合)的代码
*/
function genSelect (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
) {
  // 存在修饰符 && 确定number修饰符是否存在
  const number = modifiers && modifiers.number
  // Array.prototype.filter.call($event.target.options,function(o){return o.selected}).
  // map(function(o){var val = "_value" in o ? o._value : o.value;return 存在number修饰符? _n(val) : val
  // 这段字符串代码的作用是将select中选中的值输出,如果存在number修饰符输出[_n(选中值)]，否则输出[选中值]
  const selectedVal = `Array.prototype.filter` +
    `.call($event.target.options,function(o){return o.selected})` +
    `.map(function(o){var val = "_value" in o ? o._value : o.value;` +
    `return ${number ? '_n(val)' : 'val'}})`
  // 这段字符串代码作用是判断select是否可以多选？$$selectedVal : $$selectedVal[0]
  const assignment = '$event.target.multiple ? $$selectedVal : $$selectedVal[0]'
  // 设置$$selectedVal = [_n(选中值)] || [选中值]
  let code = `var $$selectedVal = ${selectedVal};`
  // 这段字符串代码的作用: 设置v-model的属性值变量为select选中的值集合
  code = `${code} ${genAssignmentCode(value, assignment)}`
  // 为el的events对象中添加change事件信息{value: code}
  addHandler(el, 'change', code, null, true)
}
/*
    作用:
          1、解析标签为input(类型不为select || checkbox || radio)和textarea标签的v-model
          2、在非生产环境下,存在动态value属性值 && 不存在动态type值时收集警告信息与v-model冲突
          3、往el的props数组中添加value属性信息对象
          4、为el的events对象中添加change(有lazy修饰符时) || input || __r(input类型为range)事件信息对象
          5、存在trim || number修饰符时,为el的events对象中添加blur事件信息对象{value: '$forceUpdate()'}
*/
function genDefaultModel (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
): ?boolean {
  // 缓存节点类型
  const type = el.attrsMap.type

  // warn if v-bind:value conflicts with v-model
  // except for inputs with v-bind:type
  // 非生产环境下
  if (process.env.NODE_ENV !== 'production') {
    // 获取动态value属性值
    const value = el.attrsMap['v-bind:value'] || el.attrsMap[':value']
    // 获取动态属性type值
    const typeBinding = el.attrsMap['v-bind:type'] || el.attrsMap[':type']
    // 存在动态value属性值 && 不存在动态type属性值 收集警告信息'与v-model冲突并且其已经扩展到内部绑定的值'
    if (value && !typeBinding) {
      const binding = el.attrsMap['v-bind:value'] ? 'v-bind:value' : ':value'
      warn(
        `${binding}="${value}" conflicts with v-model on the same element ` +
        'because the latter already expands to a value binding internally'
      )
    }
  }
  // 获取修饰符lazy, number, trim
  const { lazy, number, trim } = modifiers || {}
  // 不存在lazy修饰符&& 类型不为range,设置变量needCompositionGuard为true
  const needCompositionGuard = !lazy && type !== 'range'
  // event = 存在lazy修饰符? 'change' : 类型为range? '__r' : 'input'
  const event = lazy
    ? 'change'
    : type === 'range'
      ? RANGE_TOKEN
      : 'input'
  // 初始化获取节点值表达式
  let valueExpression = '$event.target.value'
  // 存在trim修饰符 初始化获取去掉空格节点值表达式
  if (trim) {
    valueExpression = `$event.target.value.trim()`
  }
  // 存在number修饰符 _n(获取节点值表达式)
  if (number) {
    valueExpression = `_n(${valueExpression})`
  }
  // 设置v-model属性值变量的值为节点值
  let code = genAssignmentCode(value, valueExpression)
  // 不存在lazy&&类型不为range
  if (needCompositionGuard) {
    // 这段你代码作用: 此次input事件是否是 IME 构成触发的
    code = `if($event.target.composing)return;${code}`
  }
  // 往el的props数组中添加value属性信息对象,属性值为`(v-model属性值)`
  addProp(el, 'value', `(${value})`)
  // 为el的events对象中添加change || input(取决于是否有lazy修饰符)事件信息对象{value: 字符串代码}
  // 字符串代码的作用: 设置v-model属性值变量的值为节点值
  addHandler(el, event, code, null, true)
  // 存在trim || number修饰符时,为el的events对象中添加blur事件信息对象{value: '$forceUpdate()'}
  if (trim || number) {
    addHandler(el, 'blur', '$forceUpdate()')
  }
}
