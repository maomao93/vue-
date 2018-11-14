/* @flow */

/**
 * Cross-platform code generation for component v-model
 */
export function genComponentModel (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
): ?boolean {
  const { number, trim } = modifiers || {}

  const baseValueExpression = '$$v'
  let valueExpression = baseValueExpression
  if (trim) {
    valueExpression =
      `(typeof ${baseValueExpression} === 'string'` +
      `? ${baseValueExpression}.trim()` +
      `: ${baseValueExpression})`
  }
  if (number) {
    valueExpression = `_n(${valueExpression})`
  }
  const assignment = genAssignmentCode(value, valueExpression)

  el.model = {
    value: `(${value})`,
    expression: `"${value}"`,
    callback: `function (${baseValueExpression}) {${assignment}}`
  }
}

/**
 * Cross-platform codegen helper for generating v-model value assignment code.
 */
/*
  作用:
        1、属性值不存在[ 或者 ']'字符不在参数的最后一位时,不存在.字符时   输出 value = assignment
        2、属性值存在[字符 && ']'字符为参数的最后一位时, 输出$set(${res.exp}, ${res.key}, ${assignment})
*/
export function genAssignmentCode (
  value: string, //属性值
  assignment: string
): string {
  //解析属性值(当属性值中存在[或.时)
  /*{
    exp: addcount,
    key: null
  }*/
  const res = parseModel(value)
  if (res.key === null) {
    return `${value}=${assignment}`
  } else {
    return `$set(${res.exp}, ${res.key}, ${assignment})`
  }
}

/**
 * Parse a v-model expression into a base path and a final key segment.
 * Handles both dot-path and possible square brackets.
 *
 * Possible cases:
 *
 * - test
 * - test[key]
 * - test[test1[key]]
 * - test["a"][key]
 * - xxx.test[a[a].test1[key]]
 * - test.xxx.a["asa"][test1[key]]
 *
 */

let len, str, chr, index, expressionPos, expressionEndPos

type ModelParseResult = {
  exp: string,
  key: string | null
}

/*
  作用:
        1、将属性值解析成对象(前提: 参数不存在'['字符 || ']'字符不在参数的最后一位)
          {
            exp: 参数.字符前面的字符 || 参数
            key: 参数.字符后面的字符 || null
          }
        2、将属性值解析成对象(前提: 参数存在[字符 && ']'字符为参数的最后一位)
          {
            exp: 参数[前面的字符串 || ''
            key: 参数[和]中间的字符串
          }
          否则
          {
            exp: ''
            key: ''
          }
*/
export function parseModel (val: string): ModelParseResult {
  // Fix https://github.com/vuejs/vue/pull/7730
  // allow v-model="obj.val " (trailing whitespace)
  /*去除属性值的前后空格*/
  val = val.trim()
  // 缓存属性值的长度
  len = val.length
  // 属性值不存在[字符 || 属性值中最后一个']'字符不在字符串的尾部(或不存在']')
  if (val.indexOf('[') < 0 || val.lastIndexOf(']') < len - 1) {
    // 获取属性值最后一个.字符的下标
    index = val.lastIndexOf('.')
    // 属性值存在.字符时
    if (index > -1) {
      return {
        exp: val.slice(0, index), //属性值.字符前面的字符
        key: '"' + val.slice(index + 1) + '"' // 属性值.后面的字符
      }
    } else {
      return {
        exp: val,
        key: null
      }
    }
  }
  // 缓存属性值
  str = val
  // 初始化变量
  index = expressionPos = expressionEndPos = 0
  // index < 属性字符串的长度时
  while (!eof()) {
    // 获取字符串index位置的ASCII编码
    chr = next()
    /* istanbul ignore if */
    // 字符为 " || '时
    if (isStringStart(chr)) {
      //更新index为第二个" || '的位置
      parseString(chr)
      // 字符为[时
    } else if (chr === 0x5B) {
      parseBracket(chr)
    }
  }

  return {
    exp: val.slice(0, expressionPos), // [前面的字符
    key: val.slice(expressionPos + 1, expressionEndPos) // [和]中间的字符
  }
}

function next (): number {
  return str.charCodeAt(++index)
}

function eof (): boolean {
  return index >= len
}
/*
  作用: 判断字符是否为 " || '
*/
function isStringStart (chr: number): boolean {
  return chr === 0x22 || chr === 0x27
}
/*
  作用: expressionPos保存的是第一个[的位置   expressionEndPos保存的是最后一个]的位置
*/
function parseBracket (chr: number): void {
  let inBracket = 1
  // 获取index的下标
  expressionPos = index
  // index < len 时
  while (!eof()) {
    // 获取下标为index字符的ASCII编码
    chr = next()
    // 判断字符是否为 " || '
    if (isStringStart(chr)) {
      // 更新index为第二个" || '的位置
      parseString(chr)
      continue
    }
    // 字符为[时 inBracket ++
    if (chr === 0x5B) inBracket++
    // 字符为]时 inBracket --
    if (chr === 0x5D) inBracket--
    // 不存在[或]时 将expressionEndPos更新为index
    if (inBracket === 0) {
      expressionEndPos = index
      break
    }
  }
}

/*
  作用: 更新index为第二个chr的位置
*/
function parseString (chr: number): void {
  // 缓存参数
  const stringQuote = chr
  // index < len 时
  while (!eof()) {
    chr = next()
    if (chr === stringQuote) {
      break
    }
  }
}
