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
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 */
const bailRE = /[^\w.$]/
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
