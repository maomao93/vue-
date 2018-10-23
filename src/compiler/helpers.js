/* @flow */

import { emptyObject } from 'shared/util'
import { parseFilters } from './parser/filter-parser'

export function baseWarn (msg: string) {
  console.error(`[Vue compiler]: ${msg}`)
}

//判断参数modules是否存在，并且返回各项m[key]不为空的数组或空数组
export function pluckModuleFunction<F: Function> (
  modules: ?Array<Object>,
  key: string
): Array<F> {
  return modules
    ? modules.map(m => m[key]).filter(_ => _)
    : []
}
/*
  作用: 往el的props数组中添加属性信息，该数组中添加的是原生dom属性
*/
export function addProp (el: ASTElement, name: string, value: string) {
  (el.props || (el.props = [])).push({ name, value })
  el.plain = false
}

/*
  作用: 往el的attrs数组中添加属性信息，该数组中添加的是绑定属性
*/
export function addAttr (el: ASTElement, name: string, value: any) {
  (el.attrs || (el.attrs = [])).push({ name, value })
  el.plain = false
}

// add a raw attr (use this in preTransforms)
/*
  作用: 将name属性和值添加到AST树对象的attrsMap映射对象中，往attrsList数组中添加改属性信息
*/
export function addRawAttr (el: ASTElement, name: string, value: any) {
  el.attrsMap[name] = value
  el.attrsList.push({ name, value })
}

export function addDirective (
  el: ASTElement,
  name: string,
  rawName: string,
  value: string,
  arg: ?string,
  modifiers: ?ASTModifiers
) {
  (el.directives || (el.directives = [])).push({ name, rawName, value, arg, modifiers })
  el.plain = false
}

export function addHandler (
  el: ASTElement, // 当前元素描述对象
  name: string, // 绑定属性的名字，即事件名称
  value: string, // 绑定属性的值，这个值有可能是事件回调函数名字，有可能是内联语句，有可能是函数表达式
  modifiers: ?ASTModifiers,// 修饰符对象
  important?: boolean,// 代表着添加的事件侦听函数的重要级别
  warn?: Function // 打印警告信息的函数，是一个可选参数
) {
  // 获取modifiers参数|| 一个冻结的空对象
  modifiers = modifiers || emptyObject
  // warn prevent and passive modifier
  /* istanbul ignore if */
  // 非生产环境下&&存在警告函数&&存在prevent修饰符&&存在passive修饰符时
  // 提示开发者 passive 修饰符不能和 prevent 修饰符一起使用
  if (
    process.env.NODE_ENV !== 'production' && warn &&
    modifiers.prevent && modifiers.passive
  ) {
    warn(
      'passive and prevent can\'t be used together. ' +
      'Passive handler can\'t prevent default event.'
    )
  }

  // check capture modifier
  // capture修饰符存在时删除capture修饰符并且赋值属性名为!属性名
  if (modifiers.capture) {
    delete modifiers.capture
    name = '!' + name // mark the event as captured
  }
  // once修饰符存在时删除once修饰符并且赋值属性名为~属性名
  if (modifiers.once) {
    delete modifiers.once
    name = '~' + name // mark the event as once
  }
  /* istanbul ignore if */
  // passive修饰符存在时删除passive修饰符并且赋值属性名为&属性名
  if (modifiers.passive) {
    delete modifiers.passive
    name = '&' + name // mark the event as passive
  }

  // normalize click.right and click.middle since they don't actually fire
  // this is technically browser-specific, but at least for now browsers are
  // the only target envs that have right/middle clicks.
  /*属性名为click时*/
  if (name === 'click') {
    // 存在right修饰符时
    if (modifiers.right) {
      // 属性名设置为contextmenu
      name = 'contextmenu'
      // 删除right修饰符
      delete modifiers.right
      // 存在middle修饰符时
    } else if (modifiers.middle) {
      // 属性名设置为mouseup
      name = 'mouseup'
    }
  }

  let events
  // 存在native修饰符时缓存el.nativeEvents否则缓存el.events
  if (modifiers.native) {
    // 删除native修饰符
    delete modifiers.native
    // 缓存el的nativeEvents || 空对象
    events = el.nativeEvents || (el.nativeEvents = {})
  } else {
    // 缓存el.events || 空对象
    events = el.events || (el.events = {})
  }

  const newHandler: any = {
    value: value.trim()
  }
  // modifiers参数传递时 缓存modifiers属性到newHandler对象中
  if (modifiers !== emptyObject) {
    newHandler.modifiers = modifiers
  }
  // 缓存events中name属性值
  const handlers = events[name]
  /* istanbul ignore if */
  // handlers为数组时
  if (Array.isArray(handlers)) {
    // true? 将newHandler对象存入handlers数组的头部否则尾部
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  } else if (handlers) {
    // events中name属性值存在时
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {
    // events中name属性值为null 或 nudefined 或 '' 或 0 时设置events[name]为newHandler对象
    events[name] = newHandler
  }

  el.plain = false
}

/*
  作用:
        1、获取v-bind:属性 或者:属性 的值
        2、值!=null时解析属性值当存在非短路|运算符时转换成函数表达式,并将函数表达式或原字符串返回
        3、属性值 == null && getStatic参数 !==false时,获取静态属性值,也就是不带:的该属性值，静态值!=null时返回静态值
*/
export function getBindingAttr (
  el: ASTElement, //ast树对象
  name: string,//属性名
  getStatic?: boolean
): ?string {
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) ||
    getAndRemoveAttr(el, 'v-bind:' + name)
  if (dynamicValue != null) {
    return parseFilters(dynamicValue)
  } else if (getStatic !== false) {
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      return JSON.stringify(staticValue)
    }
  }
}

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.


/*
  作用:
        1、获取attrsMap对象中的属性值
        2、值 !=null 时删除attrsList属性信息列表中该属性保存的信息
        3、在removeFromMap为true时，删除映射对象attrsMap中保存的该属性
*/
export function getAndRemoveAttr (
  el: ASTElement,//ast树对象
  name: string,//属性名
  removeFromMap?: boolean//表示是否需要删除key:val映射对象中的属性
): ?string {
  let val
  //当属性值存在时
  if ((val = el.attrsMap[name]) != null) {
    //缓存标签上的属性信息列表
    const list = el.attrsList
    //下面这个循环是找出属性信息列表中该属性的信息并删除
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  //明确表示要删除时删除映射对象attrsMap中的属性
  if (removeFromMap) {
    delete el.attrsMap[name]
  }
  //输出属性值或undefined
  return val
}
