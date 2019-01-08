/* @flow */

import {
  tip,
  hasOwn,
  isDef,
  isUndef,
  hyphenate,
  formatComponentName
} from 'core/util/index'
/*
  作用:
        1、不存在options.props直接return
        2、存在则将options.props中的属性赋值到res对象中,属性值为data.props || data.attrs中对应的属性值,
           没对应的赋值undefined
*/
export function extractPropsFromVNodeData (
  data: VNodeData,
  Ctor: Class<Component>,
  tag?: string
): ?Object {
  // we are only extracting raw values here.
  // validation and default values are handled in the child
  // component itself.

  // 缓存options中props属性
  const propOptions = Ctor.options.props
  // 不存在时return
  if (isUndef(propOptions)) {
    return
  }
  const res = {}
  // 缓存data对象中的attrs和props属性
  const { attrs, props } = data
  // 当存在attrs || props时
  if (isDef(attrs) || isDef(props)) {
    // 循环构造函数的options.props对象
    for (const key in propOptions) {
      //将驼峰转成-连接
      const altKey = hyphenate(key)
      if (process.env.NODE_ENV !== 'production') {
        // 将key转换成小写
        const keyInLowerCase = key.toLowerCase()
        // 存在大写的字母 && 存在attrs属性 && 转换小写后的key存在attrs属性中时,提示信息props中的key名和attr中的属性名不对应
        if (
          key !== keyInLowerCase &&
          attrs && hasOwn(attrs, keyInLowerCase)
        ) {
          tip(
            `Prop "${keyInLowerCase}" is passed to component ` +
            `${formatComponentName(tag || Ctor)}, but the declared prop name is` +
            ` "${key}". ` +
            `Note that HTML attributes are case-insensitive and camelCased ` +
            `props need to use their kebab-case equivalents when using in-DOM ` +
            `templates. You should probably use "${altKey}" instead of "${key}".`
          )
        }
      }
      checkProp(res, props, key, altKey, true) ||
      checkProp(res, attrs, key, altKey, false)
    }
  }
  return res
}
/*
    作用:
          1、将options.props中的属性放入res属性中,前提是该属性存在data.props || data.attrs中,并return true
          2、不存在data.props || data.attrs 时,return false,存在但并没有该属性时没有返回值
*/
function checkProp (
  res: Object,
  hash: ?Object, // props || attrs
  key: string,
  altKey: string, // 驼峰转-的key
  preserve: boolean
): boolean {
  // props不为空时
  if (isDef(hash)) {
    // key名存在对象本身时
    if (hasOwn(hash, key)) {
      // 设置res.key为props.key|| hash.key
      res[key] = hash[key]
      // 在props中删除该key 在attrs中不删除
      if (!preserve) {
        delete hash[key]
      }
      return true
      // key名转化成-时存在对象(props || attrs)本身时
    } else if (hasOwn(hash, altKey)) {
      // 设置res.key为props.key|| hash.key
      res[key] = hash[altKey]
      // 在props中删除该key 在attrs中不删除
      if (!preserve) {
        delete hash[altKey]
      }
      return true
    }
  }
  return false
}
