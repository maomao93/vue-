/* @flow */

/**
 * Check if a string starts with $ or _
 */
/*获取字段第一个字符的Unicode 编码*/
export function isReserved (str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * Define a property.
 */
export function def (obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable, //表示能否通过for-in循环返回属性
    writable: true, //表示能否修改属性的值
    configurable: true //表示能否通过delete删除属性从而重新定义属性
  })
}

/**
 * Parse simple path.
 */
const bailRE = /[^\w.$]/
/*解析表达式并返回一个可以获取obj中的表达式的值*/
export function parsePath (path: string): any {
  //带(有点的或没有的)单词字符串(这个单词是Unicode字符)
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.') //以点截成数组
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
