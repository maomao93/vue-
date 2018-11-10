/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'

// Regular Expressions for parsing tags and attributes
/*
  // \s*: 匹配任何不可见字符，包括空格、制表符、换页符 任意次
  // [^\s"'<>\/=]: 不为任何不可见字符或"或'或<>\/=字符的字符至少一个
  // (?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?: (后面必须跟 不可见字符任意个 =一个 不可见字符任意个 (后面必须跟 ( " 非"字符串任意个 "至少一个)
  //           或者 (' 非'字符串任意个 '至少一个) 或 (不为 不可见字符 " ' = < > 至少一个))) 前面的表达式最多一次
  匹配标签的属性(attributes)的
  class="some-class"、class='some-class'、class=some-class、disabled这几种
*/  // /^<\\/((?:[a-zA-Z_][\\w\\-\\.]*\\:)?[a-zA-Z_][\\w\\-\\.]*)[^>]*>/
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
// [a-zA-Z_][\w\-\.]*: 匹配 a-z或A-Z或_中任意字符串 (包括下划线的任何单词字符或-或.)任意次
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
// ((?:${ncname}\\:)?${ncname}): ((后面必须跟 ncname表达式 : )最多一次 结尾必须是ncname表达式
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
// ^<${qnameCapture}: 必须以<开头 qnameCapture表达式
const startTagOpen = new RegExp(`^<${qnameCapture}`)
// ^\s*(\/?)>: 必须以非任何不可见字符开头  /字符最多一次  >
const startTagClose = /^\s*(\/?)>/
// ^<\\/${qnameCapture}[^>]*>: 必须以<开头 /字符 qnameCapture表达式 非>字符串任意个 >
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

//在老版本火狐下为true其他为false
let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  //m: 与x(.)?匹配的值
  //g: 与.匹配的值
  IS_REGEX_CAPTURING_BROKEN = g === ''
})

// Special Elements (can contain anything)
/*返回一个检测参数转为小写后是否为下面字段的函数*/
export const isPlainTextElement = makeMap('script,style,textarea', true)
//生成一个reCache空对象
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
//判断tag是否存在并且是(pre或textarea)并且模板字符串第一个字符是换行符
//作用: 判断是否应该忽略标签内容的第一个换行符的
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

//将value中的unicode转为字符
function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  //生成空数组stack
  const stack = []
  //缓存options.expectHTML
  const expectHTML = options.expectHTML
  //缓存options.isUnaryTag函数(判断给定的标签是否是一元标签)或(返回值为false的空函数)
  const isUnaryTag = options.isUnaryTag || no
  //缓存options.canBeLeftOpenTag函数(检测一个标签是否是那些虽然不是一元标签，但却可以自己补全并闭合的标签)或(返回值为false的空函数)
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  //初始化index为0
  let index = 0
  //初始化last, lastTag
  let last, lastTag
  //判断模板字符串是否存在
  while (html) {
    //缓存模板字符串为last
    last = html
    // Make sure we're not in a plaintext content element like script/style
    //lastTag为空或lastTag不为script,style,textarea中的一个
    if (!lastTag || !isPlainTextElement(lastTag)) {
      //获取<的在模板字符串中的位置
      let textEnd = html.indexOf('<')
      //为首字母时
      if (textEnd === 0) {
        /*
          1、可能是注释节点：<!-- -->
          2、可能是条件注释节点：<![ ]>
          3、可能是 doctype：<!DOCTYPE >
          4、可能是结束标签：</xxx>
          5、可能是开始标签：<xxx>
          6、可能只是一个单纯的字符串：<abcdefg
        */
        // Comment:
        //模板字符串存在<--字符时
        if (comment.test(html)) {
          //获取模板字符串中-->的位置下标
          const commentEnd = html.indexOf('-->')
          //存在-->的时
          if (commentEnd >= 0) {
            //判断是否需要保留且渲染模板中的 HTML 注释
            if (options.shouldKeepComment) {
              //获取模板字符串第4个字符到'-->'字符中间的字符串放入currentParent.children数组中
              options.comment(html.substring(4, commentEnd))
            }
            //缓存剔除注释后的模板字符串
            advance(commentEnd + 3)
            //退出当前执行进行下一个循环
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        //判断是否有兼容浏览器的注释比如<!--[if !IE]>--> 有则将其剔除并缓存剔除后的模板字符串然后退出当前循环
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')
          //条件注释节点将直接删除不做保存
          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        //存在<!DOCTYPE html>的模板字符串将<!DOCTYPE html>剔除并返回剔除后的模板字符串然后退出当前循环
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        //解析结束标签(必须以</开头的字符串，所以会先解析开始标签)
        /*   ^<\\/((?:[a-zA-Z_][\\w\\-\\.]*\\:)?[a-zA-Z_][\\w\\-\\.]*)     */
        const endTagMatch = html.match(endTag)//[<]
        //存在结束标签 比如: </div> </kk:a-c>
        if (endTagMatch) {
          //缓存起始下标
          const curIndex = index
          //获取结束标签后面的字符串，并且将起始下标更新
          advance(endTagMatch[0].length)
          //开始解析结束标签信息(正则捕获的标签名, 起始下标, 结束标签后面那个字符的下标)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        //解析开始标签
        /*match = {
          tagName: 'div',
          attrs: [
            [
              ' v-for="v in map"',
              'v-for',
              '=',
              'v in map',
              undefined,
              undefined
            ]
          ],
          start: 'index:<div的位置',
          unarySlash: '/或undefined',
          end: 'index:>的位置'
        }*/
        const startTagMatch = parseStartTag()
        //存在开始标签
        if (startTagMatch) {
          //进一步处理起始标签的信息
          handleStartTag(startTagMatch)
          //lastTag存在&&lastTag不为pre,textarea标签&&html模板第一个字符是'\n'字符时
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            //截取'\n'后面的字符串
            advance(1)
          }
          //进行下一个循环
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        //缓存<字符后面的模板字符(包括<)
        rest = html.slice(textEnd)
        // let m = /[a-zA-Z_][\w\-\.]*/
        //模板字符开头不是</m && 模板字符开头不是<m(比如'<(') && 模板字符开头不是<!-- && 模板字符开头不是<![ 时进入循环
        //<存在于普通文本中,类似这种情况'<(<(<(wer<(',以下循环的作用: 将rest更新为最后一个<(包括<)的模板字符串,并将textEnd更新为最后一个<的下标
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          /* 从第二个字符开始查询'<'并返回位置(因为第一个是<)*/
          next = rest.indexOf('<', 1)
          //没有找到<时退出循环
          if (next < 0) break
          //找到<时,将textEnd下标更新为<后面第一个<的位置
          textEnd += next
          //将模板字符更新为<后面第一个<(包括<)的模板字符串
          rest = html.slice(textEnd)
        }
        //缓存最后一个<前面的字符
        text = html.substring(0, textEnd)
        //将模板字符更新为最后一个<后面的字符(包括<)
        advance(textEnd)
      }
      //模板字符串不存在<时,将模板字符串缓存给text并且将模板字符串设置为''
      if (textEnd < 0) {
        text = html
        html = ''
      }
      //当存在不合格的根元素时或纯文本模板时提示不同的错误信息
      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      // lastTag不为空(有未闭合的标签) && 标签为script,style,textarea 时
      let endTagLength = 0
      // 缓存lastTag标签
      const stackedTag = lastTag.toLowerCase()
      // 获取reCache对象中stackedTag属性值 || 正则表达式 作用: 用来匹配纯文本标签的内容以及结束标签的
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        /*
            all: 完全匹配的值
            text: 第一个捕获值
            endTag: 第二个捕获值
        */
        //获取endTag字符的长度
        endTagLength = endTag.length
        //标签不为script,style,textarea,noscript
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        // stackedTag存在&&stackedTag不为pre,textarea标签&&捕获字符text第一个字符是'\n'字符时将'\n'字符去掉
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      // 更新初始下标index(原模板字符 - 原模板字符去除(与reStackedTag正则匹配的字符 前提匹配成功) = 0 || 与reStackedTag正则匹配的字符的长度)
      index += html.length - rest.length
      // 更新模板字符串(去除reStackedTag正则匹配后的字符)
      html = rest
      // 参数: 纯文本标签(script,style,textarea)  初始标签<的位置 || 结束标签</的位置 初始标签>的位置 || 结束标签>的位置
      parseEndTag(stackedTag, index - endTagLength, index)
    }
    //纯文本或不合格的标签提示错误信息: 字符串的结尾不符合标签格式(还需理解)
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()
  //截取字符串
  function advance (n) {
    index += n
    html = html.substring(n)
  }
  //解析起始标签(读取标签中的属性并保存)
  /*
    作用:
        解析起始标签，保存该标签起始标签在html中的起始位置和结束位置以及
        所有的属性字符串,最后将这个信息输出,并将该起始标签在html中剔除。
    最重要一点是必须有结束标签>才行
  */
  function parseStartTag () {
    /*const ncname = '[a-zA-Z_][\\w\\-\\.]*'
    const qnameCapture = `((?:${ncname}\\:)?${ncname})`
    const startTagOpen = new RegExp(`^<${qnameCapture}`)*/
    //获取开始标签和标签名[<div,div]
    const start = html.match(startTagOpen)
    //存在
    if (start) {
      const match = {
        tagName: start[1],//标签名
        attrs: [],//属性数组
        start: index //标签位置
      }
      //将<div字符后面的字符串赋值给模板字符串,并将起始下标跟新
      advance(start[0].length)
      //初始化结束标签数组和属性数组
      let end, attr
      /*
        当没有匹配到/>或>字符(没有匹配到开始标签的结束部分) 并且
        匹配到这几种 class="some-class"、class='some-class'、class=some-class、disabled 类型的字符 才进入循环
        意思: 没有结束标签但又写了属性
        便于理解:  \s 等价于 [\f\n\r\t\v]
                const startTagClose = /^\s*(\/?)>/
                const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
      */
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        //将匹配到的属性字符后面的字符串赋值给模板字符串,并将起始下标跟新
        advance(attr[0].length)
        //将attr数组push到match.attrs数组中
        match.attrs.push(attr)
      }
      //存在结束标签
      if (end) {
        //为match添加新属性unarySlash, 并将/或''赋值给这个属性
        match.unarySlash = end[1]
        //将/>或>后面的字符串赋值给模板字符串,并将起始下标跟新
        advance(end[0].length)
        //为match添加新属性end, 并将/>或>的位置赋值给该属性
        match.end = index
        // 将match对象输出
        return match
      }
    }
  }
  /*
    作用:
          1、当上一个起始标签为p并且当前起始标标签是类似于div这种非段落式标签时进行特殊处理
          2、循环处理标签的属性值
          3、将不是一元标签或不存在/结束标识符的起始标签放入stack数组
  */
  function handleStartTag (match) {
    //缓存开始标签名
    const tagName = match.tagName
    //缓存结束的标识符(/或undefined)
    const unarySlash = match.unarySlash
    //这个默认传递的是true
    if (expectHTML) {
      //判断lastTag(上一个起始标签)是否是p元素，当前标签不是段落式内容模型类似div这些
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      /*检测一个标签是否是(那些虽然不是一元标签，但却可以自己补全并闭合的标签) && lastTag === 当前标签名 (比如: <p><p>)*/
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        //解析当前节点
        parseEndTag(tagName)
      }
    }
    //判断开始标签是否是一元标签 或是否存在/结束标识符
    const unary = isUnaryTag(tagName) || !!unarySlash
    //缓存标签属性数组的长度
    const l = match.attrs.length
    //初始化一个数组长度为标签属性数组长度的数组
    const attrs = new Array(l)
    //循环
    for (let i = 0; i < l; i++) {
      //缓存各个属性数组
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      // IS_REGEX_CAPTURING_BROKEN:判断捕获不到正则()中的值时返回的是undefined还是'',''为true否则为false
      // IS_REGEX_CAPTURING_BROKEN为true并且属性表达式中的值没有""包裹时,将数组中的3、4、5项删除
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }
      //缓存属性的值
      const value = args[3] || args[4] || args[5] || ''
      //当标签名为a并且有href属性时，判断是否将特殊字符转义了  不为时也判断是否将特殊字符转义了
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],//缓存标签名
        value: decodeAttr(value, shouldDecodeNewlines) //如果转义了字符则将转义了的字符还原并缓存属性值
      }
    }
    //不是一元标签或不存在/结束标识符时
    if (!unary) {
      //将节点的信息放入stack数组中
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      //将该标签名赋值给lastTag变量
      lastTag = tagName
    }
    //判断参数中是否有start属性
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }
  //解析结束标签
  /*
    作用:
          1、检测是否缺少闭合标签
          2、处理 stack 栈中剩余的标签
          3、解析 </br> 与 </p> 标签，与浏览器的行为相同
  */
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index
    //标签名传递时
    if (tagName) {
      //缓存标签名
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type

    //标签名传递时
    if (tagName) {
      //从栈顶到栈底的循环，找到与传进来的标签名参数相同的标签名
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }
    //在stack数组中的找到了标签名或未传标签名参数
    if (pos >= 0) {
      /*比如: (<p><div>) 、 (<p><p>)这些就会补全标签名*/
      // Close all the open elements, up the stack
      /*从栈顶到栈底循环stack数组,当传进来的标签tagName不是在数组stack的尾部则进行警告提示表示少闭合标签*/
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        //存在end属性时将该标签闭合
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }
      // Remove the open elements from the stack
      stack.length = pos // 更新stack数组，删除在stack数组的该项标签信息(包括该下标后面的前提存在的话)
      lastTag = pos && stack[pos - 1].tag // 将lastTag更新为改标签的前一个起始标签
    }
    /*以下情况一般为在解析闭合开关时才会出现的情况*/
    else if (lowerCasedTagName === 'br') {
      //不存在stack数组中并且标签名为br时
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      //不存在stack数组中并且标签名为p时
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      //将p标签闭合
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
