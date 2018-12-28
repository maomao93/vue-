/* @flow */

import VNode, { createTextVNode } from 'core/vdom/vnode'
import { isFalse, isTrue, isDef, isUndef, isPrimitive } from 'shared/util'

// The template compiler attempts to minimize the need for normalization by
// statically analyzing the template at compile time.
//
// For plain HTML markup, normalization can be completely skipped because the
// generated render function is guaranteed to return Array<VNode>. There are
// two cases where extra normalization is needed:

// 1. When the children contains components - because a functional component
// may return an Array instead of a single root. In this case, just a simple
// normalization is needed - if any child is an Array, we flatten the whole
// thing with Array.prototype.concat. It is guaranteed to be only 1-level deep
// because functional components already normalize their own children.
/*
    作用: 将children参数数组的某一项为数组时返回一个全新的children数组否则返回原children参数
*/
export function simpleNormalizeChildren (children: any) {
  for (let i = 0; i < children.length; i++) {
    if (Array.isArray(children[i])) {
      return Array.prototype.concat.apply([], children)
    }
  }
  return children
}

// 2. When the children contains constructs that always generated nested Arrays,
// e.g. <template>, <slot>, v-for, or when the children is provided by user
// with hand-written render functions / JSX. In such cases a full normalization
// is needed to cater to all possible types of children values.
/*
  作用:
        1、当children参数为string、number、symbol、boolean类型时,输出一个[文本节点]
        2、当children参数为数组时,对各个子节点进行处理并输出处理过后的子节点集合数组
        3、不满足以上时返回undefined
*/
export function normalizeChildren (children: any): ?Array<VNode> {
  return isPrimitive(children)
    ? [createTextVNode(children)]
    : Array.isArray(children)
      ? normalizeArrayChildren(children)
      : undefined
}
/*
    作用: 判断(节点和节点文本内容是否不为undefined || null)&&节点是否不为注释节点
*/
function isTextNode (node): boolean {
  return isDef(node) && isDef(node.text) && isFalse(node.isComment)
}

/*
    作用:
          1、处理节点中的子节点进行2、3、4步。
          2、合并相邻的文本节点创建成一个新的文本节点,并放入res数组中。
          3、对可能由v-for生成的节点设置key值,并放入res数组中。
          4、将res数组输出
*/
function normalizeArrayChildren (children: any, nestedIndex?: string): Array<VNode> {
  // 初始化空数组
  const res = []
  let i, c, lastIndex, last
  // 循环children数组
  for (i = 0; i < children.length; i++) {
    c = children[i]
    // 判断单个子节点是否为undefined || null || 子节点为boolean类型 进入下一循环
    if (isUndef(c) || typeof c === 'boolean') continue
    // 设置lastIndex为res数组最后一项的下标
    lastIndex = res.length - 1
    // 设置last为数组最后一项
    last = res[lastIndex]
    //  nested
    // 判断单个子节点是否为数组形式
    if (Array.isArray(c)) {
      // 判断单个子节点下面是否有多个子节点
      if (c.length > 0) {
        // 递归处理
        c = normalizeArrayChildren(c, `${nestedIndex || ''}_${i}`)
        // merge adjacent text nodes
        // 判断子节点第一个子节点是否为文本节点 && (该节点的前一个节点为文本节点 || 该子节点为第一个子节点)
        if (isTextNode(c[0]) && isTextNode(last)) {
          // 设置数组最后一项值为(合并当前文本节点和前一个文本节点)新建的一个文本节点
          res[lastIndex] = createTextVNode(last.text + (c[0]: any).text)
          // 删除该子节点的第一个子节点
          c.shift()
        }
        // 将处理过的该子节点放入res数组中
        res.push.apply(res, c)
      }
      // 该节点类型为string、number、symbol、boolean类型时
    } else if (isPrimitive(c)) {
      // 判断res数组最后一项为文本节点时
      if (isTextNode(last)) {
        //合并相邻的文本节点,这对于SSR水化是必要的，因为文本节点是当呈现到HTML字符串时，本质上是合并的
        //合并相邻的文本成为新的文本节点，并替换前一个res中最后一项
        res[lastIndex] = createTextVNode(last.text + c)
        // 不为文本节点 && 该项子节点不为空
      } else if (c !== '') {
        // convert primitive to vnode
        // 将该子节点转化为文本节点放入res数组中
        res.push(createTextVNode(c))
      }
      // 不为数组也不为string、number、symbol、boolean类型
    } else {
      // 当该子节点为文本节点 && 前一个子节点也为文本节点时
      if (isTextNode(c) && isTextNode(last)) {
        // merge adjacent text nodes
        // 合并2个文本节点并创建一个新的文本节点将最后一项替换掉
        res[lastIndex] = createTextVNode(last.text + c.text)
      } else {
        // 嵌套数组子元素的默认键(可能由v-for生成)
        // 判断子节点集合为v-for生成的 && 该子节点标签名存在 && key属性也存在 && 存在nestedIndex参数时,
        // 设置该子节点的key属性为__vlist${nestedIndex}_${i}__
        if (isTrue(children._isVList) &&
          isDef(c.tag) &&
          isUndef(c.key) &&
          isDef(nestedIndex)) {
          c.key = `__vlist${nestedIndex}_${i}__`
        }
        // 将该子节点放入res数组中
        res.push(c)
      }
    }
  }
  // 输出res
  return res
}
