/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g
/*
  作用: 将用户自定义的纯文本插入分隔符替换原本正则表达式中的纯文本插入分隔符
*/
const buildRegex = cached(delimiters => {
  // 将分隔符进行转义($& = 与正则相匹配的字符串)比如: ((替换成\(\(
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  // 将分隔符进行转义
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  // 生成一个新的纯文本插入分隔符的正则表达式
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}

/*
  作用:
        1、将用户自定义的纯文本插入分隔符生成新的检索正则 || 默认的
        2、将匹配到的字符替换成_s(${exp}),exp为{{}}中的表达式(表达式中用了过滤器则会进行过滤器解析)，
           最后将_s(${exp})和静态字符串用+号拼接起来作为expression的属性值
        3、将匹配到的字符当做新对象的@binding属性的值和为匹配的字符串放入数组中作为tokens的属性值
        4、将{expression,tokens}输出
*/
export function parseText (
  text: string,
  delimiters?: [string, string]
): TextParseResult | void {
  // 纯文本插入分隔符(默认: {{}})用户是否自定义了？使用用户自定义的分隔符生成新的检索正则 : 默认的检索正则
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  // 未匹配到则终止该函数,表示文本中没有使用vue的字面表达式
  if (!tagRE.test(text)) {
    return
  }
  // 生成一个新的tokens数组
  const tokens = []
  // 生成一个新的rawTokens数组
  const rawTokens = []
  // 表示从头开始查找匹配字符
  let lastIndex = tagRE.lastIndex = 0
  let match, index, tokenValue
  // 循环惰性查找匹配的值
  while ((match = tagRE.exec(text))) {
    // 更新匹配到的值的下标
    index = match.index
    // push text token
    // 查找的字符的第一个字符位于整个字符的下标 > (查找的字符的最后一个字符 + 1)位于整个字符的下标
    /*
        什么情况下才会这样？举例：
          1、qweqwe{{name}}
        所以下面的判断的作用:
          将匹配到的字符前面的字符保存进数组
    */
    if (index > lastIndex) {
      // 将匹配到的字符前面的字符放入rawTokens数组中
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      // 将匹配到的字符前面的字符转化成静态字符串放入tokens数组中
      tokens.push(JSON.stringify(tokenValue))
    }
    // tag token
    // 解析字面表达式中是否使用了过滤器？_f函数表达式 : 原捕获到的字符
    const exp = parseFilters(match[1].trim())
    // 将捕获到的字符当做参数转换成_s函数表达式放入tokens数组中
    tokens.push(`_s(${exp})`)
    // 将捕获到的字符当做@binding的属性值并生成对象放入rawTokens数组中
    rawTokens.push({ '@binding': exp })
    // 更新lastIndex下标为(匹配到的字符的最后一个字符在整个字符的下标)
    lastIndex = index + match[0].length
  }
  // 最后一次匹配到的字符在整个字符串中的位置不为最后一位时
  if (lastIndex < text.length) {
    // 将最后一次匹配到的字符后面的字符放入数组中
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
  }
  // 将所有解析的表达式或静态字符串用+号连起来为expression的属性值;将rawTokens数组作为tokens的属性值;将生成的对象输出
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}
