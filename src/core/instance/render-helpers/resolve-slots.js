/* @flow */

import type VNode from 'core/vdom/vnode'

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 */
/*
    作用:
          1、循环插糟节点,将多余的slot删除,将替换插糟的节点放入slots对象中对应的插糟值属性数组中。
          2、将默认的放入slots.default数组中
          3、将替换插糟的节点中为空格文本和注释节点的删除
          4、将处理好的slots输出
*/
export function resolveSlots (
  children: ?Array<VNode>,// 插糟节点信息集合
  context: ?Component//组件实例
): { [key: string]: Array<VNode> } {
  const slots = {}
  // 不存在插糟节点直接返回空对象
  if (!children) {
    return slots
  }
  // 循环插糟节点,删除多余的slot,将替换指定的插糟的节点作为对应插糟值属性值放入slots对象中,将替换默认的放入slots.default数组中
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    // 获取slot属性
    const data = child.data
    // remove slot attribute if the node is resolved as a Vue slot node
    // 非默认插糟 && 存在其他属性(除class和style) && 存在slot属性 删除attrs.slot属性
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot
    }
    // named slots should only be respected if the vnode was rendered in the
    // same context.

    // (子组件的上下文作用域为父组件时 || 作用域函数为父组件时) && 存在指定的插糟值
    if ((child.context === context || child.fnContext === context) &&
      data && data.slot != null
    ) {
      // 获取插糟名
      const name = data.slot
      // 初始化该插糟值名属性值为数组
      const slot = (slots[name] || (slots[name] = []))
      // 替换插糟的节点为template时,将template里面的节点放入该数组中 否则直接将该替换插糟的节点放入数组中
      if (child.tag === 'template') {
        slot.push.apply(slot, child.children || [])
      } else {
        slot.push(child)
      }
    } else {
      // 替换默认的插糟则放入default属性数组中
      (slots.default || (slots.default = [])).push(child)
    }
  }
  // ignore slots that contains only whitespace

  //循环插糟值属性
  for (const name in slots) {
    // 当节点为注释节点 || 空格文本时删除该替换插糟的节点
    if (slots[name].every(isWhitespace)) {
      delete slots[name]
    }
  }
  return slots
}
/*
    作用: 替换插糟值的节点为注释节点 &&非异步工厂 || 节点文本为空格 时返回true
*/
function isWhitespace (node: VNode): boolean {
  return (node.isComment && !node.asyncFactory) || node.text === ' '
}

export function resolveScopedSlots (
  fns: ScopedSlotsData, // see flow/vnode
  res?: Object
): { [key: string]: Function } {
  res = res || {}
  for (let i = 0; i < fns.length; i++) {
    if (Array.isArray(fns[i])) {
      resolveScopedSlots(fns[i], res)
    } else {
      res[fns[i].key] = fns[i].fn
    }
  }
  return res
}
