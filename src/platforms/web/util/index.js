/* @flow */

import { warn } from 'core/util/index'

export * from './attrs'
export * from './class'
export * from './element'

/**
 * Query an element selector if it's not an element already.
 */
//查询节点并返回这个节点对象
export function query (el: string | Element): Element {
  //判断参数是否为字符串类型
  if (typeof el === 'string') {
    const selected = document.querySelector(el)//获取文档第一个el元素
    //不存在报警告并且返回一个新创建的div节点
    if (!selected) {
      process.env.NODE_ENV !== 'production' && warn(
        'Cannot find element: ' + el
      )
      return document.createElement('div')
    }
    return selected
  } else {
    return el
  }
}
