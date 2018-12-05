/* @flow */

import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { genAssignmentCode } from '../directives/model'
import { extend, cached, no, camelize } from 'shared/util'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  pluckModuleFunction
} from '../helpers'

export const onRE = /^@|^v-on:/
export const dirRE = /^v-|^@|^:/
export const forAliasRE = /([^]*?)\s+(?:in|of)\s+([^]*)/
export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g

const argRE = /:(.*)$/
export const bindRE = /^:|^v-bind:/
const modifierRE = /\.[^.]+/g

const decodeHTMLCached = cached(he.decode)

// configurable state
export let warn: any
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace

type Attr = { name: string; value: string };

//创建AST树
export function createASTElement (
  tag: string,
  attrs: Array<Attr>,
  parent: ASTElement | void
): ASTElement {
  return {
    type: 1, //标签类型
    tag, //标签名
    attrsList: attrs, //属性数组集合
    attrsMap: makeAttrsMap(attrs), //key:value对象
    parent, //当前元素的父元素
    children: [] //空的子元素集合
  }
}

/**
 * Convert HTML string to AST.
 */
// 将字符串模板解析成AST树
export function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  //获取错误提示函数或默认的错误提示函数
  warn = options.warn || baseWarn
  //缓存(判断tag是否是pre的函数)或(返回值为false的空函数)
  platformIsPreTag = options.isPreTag || no
  //缓存mustUseProp函数或(返回值为false的空函数)
  platformMustUseProp = options.mustUseProp || no
  //缓存getTagNamespace函数或(返回值为false的空函数)
  platformGetTagNamespace = options.getTagNamespace || no

  //缓存modules中各个transformNode函数数组
  transforms = pluckModuleFunction(options.modules, 'transformNode')
  //缓存modules中各个preTransformNode函数数组
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  //缓存modules中各个postTransformNode函数数组
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  //缓存options.delimiters
  delimiters = options.delimiters

  //生成一个空数组stack
  const stack = []
  //判断options.preserveWhitespace是否全不等 false 并缓存结果(weex下preserveWhitespace才为false)
  const preserveWhitespace = options.preserveWhitespace !== false
  let root
  let currentParent
  let inVPre = false // 标识当前解析的标签是否在拥有 v-pre 的标签之内
  let inPre = false // 标识当前正在解析的标签是否在 <pre></pre> 标签之内
  let warned = false
  //执行一次错误提示
  function warnOnce (msg) {
    if (!warned) {
      warned = true
      warn(msg)
    }
  }
  /*
    作用: 初始化inVPre和inPre表示已经跳出pre标签内或v-pre属性的标签内。
  */
  function closeElement (element) {
    // check pre state
    //判断节点是否存在pre属性
    if (element.pre) {
      inVPre = false
    }
    //判断节点名是否为pre
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
    // apply post-transforms
    //执行postTransforms数组中的所有postTransformNode函数(只有weex中有该函数，在web是个空数组)
    for (let i = 0; i < postTransforms.length; i++) {
      postTransforms[i](element, options)
    }
  }

  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    shouldKeepComment: options.comments,
    /*
      作用:
           1、兼容IE浏览器下svg的一些问题并生成当前节点的ASTElement信息对象。
           2、模板中存在style标签或者script标签提示警告信息
           3、对input标签进行处理。
           4、在pre标签内或存在v-pre属性的标签内,并分别设置inPre或inVPre变量为true,将所有的属性值变成静态的字符串属性值.
           5、不为pre标签或不存在v-pre属性的标签内,对未处理过的节点进行处理.
           6、对根标签为slot或template进行提示错误,对存在v-for属性的根标签提示错误信息
           7、存在兄弟根标签,将存在elseif或else属性的兄弟标签信息放入根标签的ifConditions数组中，否则提示警告
           8、存在父标签&&不为(style || script)标签时.
              ·当前标签存在elseif || else属性时,将当前节点信息放入存在if属性的上一个兄弟节点信息ASTElement对象中的ifConditions数组中.
              ·存在slotScope属性时,设置plain属性为false,scopedSlots对象的(default或用户设置的名字)属性为当前节点的ASTElement信息对象。
              ·不满足上面条件,将当前节点的ASTElement信息对象放入父标签的children数组中，设置ASTElement信息对象的parent属性为父标签信息
           9、·非一元标签或没有/的结束标签,设置currentParent为当前标签信息,将信息放入stack数组中。
              ·inVPre和inPre为true时,初始化inVPre和inPre表示已经跳出pre标签内或v-pre属性的标签内。
    */
    start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one

      //判断 当前currentParent是否存在并且存在ns属性  或者 当前标签名是否是svg或math
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      //当浏览器为IE并且标签名为svg时
      if (isIE && ns === 'svg') {
        //将处理过后的属性数组重新赋值给attrs数组
        attrs = guardIESVGBug(attrs)
      }
      //创建AST树
      let element: ASTElement = createASTElement(tag, attrs, currentParent)
      //判断ns是否存在或为true
      if (ns) {
        //将ns属性添加到当前AST树对象上
        element.ns = ns
      }
      //判断是不(服务端)并且是style标签或者script标签
      if (isForbiddenTag(element) && !isServerRendering()) {
        //将forbidden属性添加到element对象上
        element.forbidden = true
        //在非生产环境下提示错误
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.'
        )
      }

      // apply pre-transforms
      // 对input标签进行处理
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element
      }
      if (!inVPre) {
        // 存在v-pre属性时设置ASTElement对象的pre属性为true
        processPre(element)
        if (element.pre) {
          // 设置inVPre为true,表示接下来解析的标签在拥有 v-pre 的标签之内
          inVPre = true
        }
      }
      // 当标签为pre时,设置inPre为true,表示接下来解析的标签都在<pre></pre> 标签之内
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
      } else if (!element.processed) {
        // structural directives
        processFor(element)
        processIf(element)
        processOnce(element)
        // element-scope stuff
        processElement(element, options)
      }
      /*
        作用:
              1、在非生产环境下,当标签为'slot'或'template'时，将错误提示
               '不能使用'template'作为组件根元素，因为它可能包含多个节点'放入errors数组中

              2、当节点存在v-for属性时,将错误提示'不能在根组件上使用v-for属性'放入errors数组中。
      */
      function checkRootConstraints (el) {
        if (process.env.NODE_ENV !== 'production') {
          if (el.tag === 'slot' || el.tag === 'template') {
            warnOnce(
              `Cannot use <${el.tag}> as component root element because it may ` +
              'contain multiple nodes.'
            )
          }
          if (el.attrsMap.hasOwnProperty('v-for')) {
            warnOnce(
              'Cannot use v-for on stateful component root element because ' +
              'it renders multiple elements.'
            )
          }
        }
      }

      // tree management
      // 当前标签为模板的第一个根标签
      if (!root) {
        // 将当前标签信息赋值给root
        root = element
        // 当标签名为slot或template时或存在v-for属性时收集提示错误信息
        checkRootConstraints(root)
        // 当已有根标签 && 当前标签为根标签的兄弟标签
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        // 已有根标签存在if属性 && (当前标签存在elseif或else属性)
        if (root.if && (element.elseif || element.else)) {
          // 当标签名为slot或template时或存在v-for属性时收集提示错误信息
          checkRootConstraints(element)
          // 将存在elseif属性或else属性的当前节点放入存在if属性的上一个兄弟节点信息ASTElement对象中的ifConditions数组中
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          })
          // 不满足上面条件&&在非生产环境下将错误提示放入errors数组中
        } else if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`
          )
        }
      }
      // 当前标签存在父标签 && 不为(style || script)标签时
      if (currentParent && !element.forbidden) {
        // 当前标签存在elseif || else属性时
        if (element.elseif || element.else) {
          // 将当前节点信息放入存在if属性的上一个兄弟节点信息ASTElement对象中的ifConditions数组中
          processIfConditions(element, currentParent)
        } else if (element.slotScope) { // scoped slot
          currentParent.plain = false
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        } else {
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }
      if (!unary) {
        // 非一元标签或没有/的结束标签,设置currentParent为当前标签信息
        currentParent = element
        //将信息放入stack数组中
        stack.push(element)
      } else {
        closeElement(element)
      }
    },
    /*
      作用:
            1、将stack数组中的最后一个标签信息的children数组的最后一个子标签信息缓存,如果该节点为纯文本标签&&文本为' ' &&不是pre标签则将该子节点信息
               从children数组中删除。
            2、将该标签信息从stack数组中删除,并设置currentParent为当前stack数组的最后一个标签信息,inVPre和inPre为true时,初始化inVPre和inPre表示已经跳出pre标签内或v-pre属性的标签内。
    */
    end () {
      // remove trailing whitespace

      // 缓存栈顶的标签信息
      const element = stack[stack.length - 1]
      // 获取该标签信息最后一个子元素的信息
      const lastNode = element.children[element.children.length - 1]
      // 存在子信息&&是文本信息&&是空格字符&&不是pre标签
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        //移除最后一个子标签
        element.children.pop()
      }
      // pop stack
      // 将该标签信息从stack数组中删除
      stack.length -= 1
      // 当前父元素设置为stack数组中最后一个标签信息
      currentParent = stack[stack.length - 1]
      closeElement(element)
    },
    /*
      作用:
            1、纯文本的template提示错误信息缺少根元素
            2、不合格的根元素提示将会被忽略根元素外的文本内容
            3、存在vue字面表达式&&不存在v-pre属性&&(存在text||不为pre标签)时将
               该节点信息设置为type:2的对象放入children数组中
            4、当做type:3的普通文本放入children数组中
    */
    chars (text: string) {
      //不存在父元素时
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            //在非生产环境下,text参数等于模板字符串时，提示缺少根元素
            warnOnce(
              'Component template requires a root element, rather than just text.'
            )
          } else if ((text = text.trim())) {
            //在非生产环境下,text参数去除左右空格后，提示根元素之外的文本text参数将被忽略
            warnOnce(
              `text "${text}" outside root element will be ignored.`
            )
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }
      const children = currentParent.children
      // pre标签 || text前后去空文本? (style ||script标签? text : 转义后的文本) :
      // (保留空格 && 存在子元素? ' ' : '')
      text = inPre || text.trim()
        ? isTextTag(currentParent) ? text : decodeHTMLCached(text)
        // only preserve whitespace if its not right after a starting tag
        : preserveWhitespace && children.length ? ' ' : ''
      // text为'' && 标签不为pre &&(不保留空格字符 || 当前标签的children对象为空数组)时不进if判断
      if (text) {
        let res
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
          children.push({
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text
          })
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          children.push({
            type: 3,
            text
          })
        }
      }
    },
    /*参数的值为注释节点的内容*/
    comment (text: string) {
      currentParent.children.push({
        type: 3,
        text,
        isComment: true
      })
    }
  })
  return root
}

/*
    作用: 节点存在v-pre属性时设置el.pre为true
*/
function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}
/*
  作用: 将所有的属性值变成静态的字符串属性值
*/
function processRawAttrs (el) {
  const l = el.attrsList.length
  if (l) {
    const attrs = el.attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attrsList[i].name,
        value: JSON.stringify(el.attrsList[i].value)
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}
/*
    作用:
          1、处理key属性
          2、处理ref属性
          3、处理slot属性
          4、处理is属性和inline-template属性
          5、处理静态和动态的style和class的
          6、处理指令属性
*/
export function processElement (element: ASTElement, options: CompilerOptions) {
  processKey(element)

  // determine whether this is a plain element after
  // removing structural attributes
  element.plain = !element.key && !element.attrsList.length

  processRef(element)
  processSlot(element)
  processComponent(element)
  // 处理静态和动态的style和class的
  for (let i = 0; i < transforms.length; i++) {
    element = transforms[i](element, options) || element
  }
  processAttrs(element)
}
/*
  作用: 解析key属性并当标签为template时提示警告,ASTElement对象中添加key属性值
*/
function processKey (el) {
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    if (process.env.NODE_ENV !== 'production' && el.tag === 'template') {
      warn(`<template> cannot be keyed. Place the key on real elements instead.`)
    }
    el.key = exp
  }
}
/*
  作用:
        1、解析ref属性并在ASTElement对象中添加ref属性
        2、判断ref是否v-for指令中并将判断的值赋值给ASTElement对象中refInFor属性
*/
function processRef (el) {
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref
    el.refInFor = checkInFor(el)
  }
}

// 作用: 解析v-for属性值，并将其解析过的值信息合并到AST树对象中，错误的写法将会在非生产环境下提示警告无效的v-for表达式
export function processFor (el: ASTElement) {
  let exp
  //获取v-for属性值并判断是否存在值并将attrsList中该属性的信息(前提存在该属性)
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    //解析v-for属性值并缓存解析过的值信息输出
    const res = parseFor(exp)
    // 属性值的书写格式正确时将解析过的值信息res合并到AST树对象中否则警告提示表达式有问题
    if (res) {
      extend(el, res)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(
        `Invalid v-for expression: ${exp}`
      )
    }
  }
}

type ForParseResult = {
  for: string;
  alias: string;
  iterator1?: string;
  iterator2?: string;
};

//作用: 解析v-for的属性值并将解析过的值信息输出
export function parseFor (exp: string): ?ForParseResult {
  // 方便解析: const forAliasRE = /([^]*?)\s+(?:in|of)\s+([^]*)/
  const inMatch = exp.match(forAliasRE)
  //不存在in或for直接return
  if (!inMatch) return
  const res = {}
  //(?:in|of)这个是不会被捕获的所以inMatch[2]就是被循环的数据
  res.for = inMatch[2].trim()
  // 方便解析: const stripParensRE = /^\(|\)$/g ('\('或'\)'的意思)
  // 获取(为开头后面的字符或者)结尾前面的字符
  const alias = inMatch[1].trim().replace(stripParensRE, '')
  // 方便解析: const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
  const iteratorMatch = alias.match(forIteratorRE)
  // 判断是否有匹配的值
  if (iteratorMatch) {
    // 获取,前面的字符串赋值给res.alias
    res.alias = alias.replace(forIteratorRE, '')
    // 将,后面的字符串赋值给res.iterator1
    res.iterator1 = iteratorMatch[1].trim()
    // 判断是否存在第二个,
    if (iteratorMatch[2]) {
      // 将第二个,后面的字符串赋值给res.iterator2
      res.iterator2 = iteratorMatch[2].trim()
    }
  } else {
    //没有,则将in前面的字符串赋值给res.alias
    res.alias = alias
  }
  //输出解析后的v-for属性信息
  return res
}
//作用: 用于处理v-if、v-else、v-else-if指令的
function processIf (el) {
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

/*
    作用: 将存在elseif属性或else属性的当前节点放入存在if属性的上一个兄弟节点信息ASTElement对象中的ifConditions数组中
*/
function processIfConditions (el, parent) {
  // 获取当前节点的上一个节点标签的信息
  const prev = findPrevElement(parent.children)
  // 上一个标签节点存在 && 存在if属性时
  // 生成{exp: 当前标签的elseif属性,block: 当前标签ASTElement对象}放入上一个标签信息ASTElement对象的ifConditions数组中
  // 也就是遵循了一个规则,会将存在elseif || else属性的当前标签信息放入存在if属性的上一个标签的ASTElement对象中,
  // 也就是在父标签信息中只存放一个标签信息
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    // 将错误提示'使用else-if或else需要有相对应的v-if'放入errors数组中
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`
    )
  }
}
/*
  作用: 将父标签的children数组中的文本节点删除,并将从尾到头循环遇到的第一个标签节点信息输出
*/
function findPrevElement (children: Array<any>): ASTElement | void {
  // 获取父元素的子元素集合数组的长度
  let i = children.length
  // 循环该集合
  while (i--) {
    // 当元素为节点标签时直接输出该子标签的ASTElement对象
    if (children[i].type === 1) {
      return children[i]
    } else {
      // 在非生产环境下 && 该子元素内容为空格字符的文本节点时,将错误提示'在v-if和v-else(-if)标签之间的文本会被忽略'
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`
        )
      }
      // 将非节点标签的子元素从父元素ASTElement对象的children数组中删除该子元素信息
      children.pop()
    }
  }
}
/*
  作用: 往ASTElement信息对象中添加ifConditions数组，数组中保存的是存在v-if、v-else、v-else-if指令的兄弟节点信息
*/
export function addIfCondition (el: ASTElement, condition: ASTIfCondition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}
/*
  作用: 处理v-once指令
*/
function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}
/*
    作用:
          1、当标签名为slot时获取name或:name或v-bind:name属性值
          2、当标签名不为slot时
              1、当标签名为template时获取scope属性值或slot-scope属性值,并在生产环境下并且不存在scope属性值时提示警告
              2、当标签名不为template时并且slot-scope属性值存在时缓存slotScope属性值。在非生产环境下 && 标签存在v-for属性时提示警告
          3、当标签名不为slot时获取节点的slot属性，当属性值存在时添加el.slotTarget属性值为"default"或属性值。当标签名不为template
             && 不存在slot-scope属性值时，往标签对象的attrs数组中添加保存slot属性信息的对象
    总结: 获取slot节点的name属性值添加为el.slotName或者 (获取template节点的scope属性值 || slot-scope属性值)为el.slotScope
          或者获取非(template、slot)节点的slot-scope属性值为el.slotScope  获取非(slot)节点的slot属性添加为el.slotTarget
*/
/*solt: {
  slotName: 'header' //name
}
template: {
  slotScope: '', // slot-scope || scope
  slotTarget: '', // slot属性存在时
  parent: {
    scopedSlots: {
      ("default" || header): ASTElement
    }, // 当存在slot-scope属性时
    children: [ASTElement] // 不存在slot-scope属性时
  }
}
'非solt非template': {
  slotScope: '', // slot-scope
  parent: {
    scopedSlots: {
      ("default" || header): ASTElement
    }, // 当存在slot-scope属性时
    children: [ASTElement] // 不存在slot-scope属性时
  }
  attrs: [{
    name: 'slot',
    value: slotTarget, //slot 当slot-scope不存在时才会将这个对象放入attrs数组中
  }]
  slotTarget: '',// slot属性存在时
}*/
function processSlot (el) {
  //当标签名为slot时
  if (el.tag === 'slot') {
    //获取标签的name属性或:name属性或v-bind:name属性
    el.slotName = getBindingAttr(el, 'name')
    if (process.env.NODE_ENV !== 'production' && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`
      )
    }
  } else {
    let slotScope
    // 当标签名为template时
    if (el.tag === 'template') {
      // 获取标签的scope属性值
      slotScope = getAndRemoveAttr(el, 'scope')
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && slotScope) {
        warn(
          `the "scope" attribute for scoped slots have been deprecated and ` +
          `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
          `can also be used on plain elements in addition to <template> to ` +
          `denote scoped slots.`,
          true
        )
      }
      // 当scope属性值不存在时获取slot-scope属性值
      el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
    } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
      /* istanbul ignore if */
      // 在非生产环境下 && 标签存在v-for属性时 提示警告使用template更清晰
      if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
        warn(
          `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
          `(v-for takes higher priority). Use a wrapper <template> for the ` +
          `scoped slot to make it clearer.`,
          true
        )
      }
      el.slotScope = slotScope
    }
    // 获取标签的:slot属性值或v-bind:slot属性值都不存在时则获取slot属性值
    const slotTarget = getBindingAttr(el, 'slot')
    // 当值存在时
    if (slotTarget) {
      // 当值为空字符串时  将el.slotTarget赋值为"default"字符串 否则赋值slot属性值
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
      // preserve slot as an attribute for native shadow DOM compat
      // only for non-scoped slots.
      /* 当标签名为template时 && 不存在slot-scope属性值时往标签的attrs数组中添加保存slot属性信息的对象*/
      if (el.tag !== 'template' && !el.slotScope) {
        addAttr(el, 'slot', slotTarget)
      }
    }
  }
}

/*
  作用:
        1、添加el.component属性值为节点的:is或is属性值(前提有值)
        2、添加el.inlineTemplate属性值为true(前提节点存在inline-template属性)
*/
function processComponent (el) {
  let binding
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}
/*
  作用:
        1、解析指令属性、方法属性、动态属性以及它们的修饰符,保存动态的属性值
        2、普通的一些属性将属性值静态化
*/
function processAttrs (el) {
  // 缓存节点的属性列表信息
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp
  // 循环属性列表信息
  for (i = 0, l = list.length; i < l; i++) {
    // 缓存属性名
    name = rawName = list[i].name
    // 缓存属性值
    value = list[i].value
    // 该属性是指令(v-、@、:)
    if (dirRE.test(name)) {
      // mark element as dynamic 将属性值标记为动态
      el.hasBindings = true
      // modifiers  解析属性名是否存在修饰符并返回undefined或{修饰符: true}
      modifiers = parseModifiers(name)
      // 存在修饰符时将缓存去除修饰符后的属性名    const modifierRE = /\.[^.]+/g
      if (modifiers) {
        name = name.replace(modifierRE, '')
      }
      /* 便于理解: const bindRE = /^:|^v-bind:/ */
      // 当属性为绑定属性时
      if (bindRE.test(name)) {
        // v-bind
        // 缓存去除绑定方法的属性值
        name = name.replace(bindRE, '')
        // 解析表达式中的过滤器并返回_f函数 或者没有过滤器的表达式
        value = parseFilters(value)
        // 标识该绑定的属性是否是原生DOM对象的属性
        isProp = false
        // 存在修饰符时
        if (modifiers) {
          // prop修饰符
          if (modifiers.prop) {
            // 表示原生DOM对象的属性
            isProp = true
            // 将-写法属性名改写成驼峰写法的属性名并缓存
            name = camelize(name)
            // 将innerHtml换成innerHTML
            if (name === 'innerHtml') name = 'innerHTML'
          }
          // camel修饰符
          if (modifiers.camel) {
            // 将-写法属性名改写成驼峰写法的属性名并缓存
            name = camelize(name)
          }
          // sync修饰符
          if (modifiers.sync) {
            addHandler(
              el, // 节点描述对象
              `update:${camelize(name)}`, // 例子: update:addCount
              genAssignmentCode(value, `$event`) //例子:${value}='$event'
            )
          }
        }
        // 标识该绑定的属性为原生DOM对象的属性 || (该标签不存在is属性 &&
        // 满足以下一种: 属性名为value的非button类型的input、属性名为selected的option、属性名为checked的input、属性名为muted的video)
        if (isProp || (
          !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
        )) {
          // 往el的props数组中添加属性信息
          addProp(el, name, value)
        } else {
          // 往el的attrs数组中添加属性信息
          addAttr(el, name, value)
        }
      } else if (onRE.test(name)) {
        // v-on
        /* 便于理解: const onRE = /^@|^v-on:/ */
        // 删除@或v-on:后的属性名
        name = name.replace(onRE, '')
        // 解析事件指令并添加到el描述对象中的events属性或nativeEvents属性中
        addHandler(el, name, value, modifiers, false, warn)
      } else { // normal directives
        // const dirRE = /^v-|^@|^:/
        // 解析其他指令(比如自定义的指令v-model)
        name = name.replace(dirRE, '')// 去掉属性名的v-
        // parse arg
        /* 便于理解: const argRE = /:(.*)$/ */
        // 获取指令的参数(:参数名) 比如: model:foo.a.b
        const argMatch = name.match(argRE)
        // 获取指令的参数名 比如 foo.a.b
        const arg = argMatch && argMatch[1]
        // 参数名存在时,获取指令名 比如model
        if (arg) {
          name = name.slice(0, -(arg.length + 1))
        }
        // 将指令信息添加到el.directives数组中 参数比如: input, model, v-model, modelValue, foo, {a: true,b: true}
        addDirective(el, name, rawName, value, arg, modifiers)
        // 非生产环境下 && 指令名为model时
        if (process.env.NODE_ENV !== 'production' && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    } else {
      // literal attribute 非指令
      // 非生产环境下
      if (process.env.NODE_ENV !== 'production') {
        const res = parseText(value, delimiters)
        if (res) {
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.'
          )
        }
      }
      addAttr(el, name, JSON.stringify(value))
      // #6887 firefox doesn't update muted state if set via attribute
      // even immediately after element creation
      // 当前标签不存在is属性 && 属性名为muted && 标签名为video时将muted属性设置值为true放入el.props数组中
      if (!el.component &&
          name === 'muted' &&
          platformMustUseProp(el.tag, el.attrsMap.type, name)) {
        addProp(el, name, 'true')
      }
    }
  }
}
/*
  作用: 判断当前标签或其祖先标签是否用了v-for指令
*/
function checkInFor (el: ASTElement): boolean {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

/*
  作用:
        1、检测name字符串是否存在(该正则/\.[^.]+/g字符串)
        2、当存在时将.后面的字符串变成空对象的属性并且值为true然后将其输出
*/
function parseModifiers (name: string): Object | void {
  /*便于理解: const modifierRE = /\.[^.]+/g */
  //截取name字符的.后面的字符(包括.)
  const match = name.match(modifierRE)
  // 存在该字符时
  if (match) {
    // 初始化ret对象
    const ret = {}
    // 将.后面的字符设置为ret的属性 属性值为true
    match.forEach(m => { ret[m.slice(1)] = true })
    // 将ret对象输出
    return ret
  }
}

//生成一个属性对应属性值的object对象(key:value)
function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] && !isIE && !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name)
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

//判断标签名是否是style或script
function isForbiddenTag (el): boolean {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
/*处理IE下svg信息的bug*/
function guardIESVGBug (attrs) {
  //创建res数组
  const res = []
  //循环标签属性
  for (let i = 0; i < attrs.length; i++) {
    //缓存处理过后的属性信息
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

/*
  作用: 检测当前元素或父元素是否存在v-for指令，并且循环的迭代名(比如list参数)当做v-model的属性值时提示警告
*/
function checkForAliasModel (el, value) {
  // 缓存el描述对象
  let _el = el
  // 当el存在时
  while (_el) {
    // 节点存在v-for && 循环的参数 === v-model的属性值 提示警告v-model不能绑定为循环的参数
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`
      )
    }
    // 赋值为节点的父节点进行检测
    _el = _el.parent
  }
}
