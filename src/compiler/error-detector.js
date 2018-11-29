/* @flow */

import { dirRE, onRE } from './parser/index'

// these keywords should not appear inside expressions, but operators like
// typeof, instanceof and in are allowed
const prohibitedKeywordRE = new RegExp('\\b' + (
  'do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,' +
  'super,throw,while,yield,delete,export,import,return,switch,default,' +
  'extends,finally,continue,debugger,function,arguments'
).split(',').join('\\b|\\b') + '\\b')

// these unary operators should not be used as property/method names
const unaryOperatorsRE = new RegExp('\\b' + (
  'delete,typeof,void'
).split(',').join('\\s*\\([^\\)]*\\)|\\b') + '\\s*\\([^\\)]*\\)')

// strip strings in expressions
const stripStringRE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g

// detect problematic expressions in a template
/*
  作用:
        1、收集ast中节点类型为1和2中指令的属性值的错误信息，并指出错误位置。
        2、将错误信息集合errors输出
*/
export function detectErrors (ast: ?ASTNode): Array<string> {
  const errors: Array<string> = []
  if (ast) {
    checkNode(ast, errors)
  }
  return errors
}
/*
   作用:
        1、处理所有类型为1节点的动态属性、指令
        2、处理类型为2的动态文本节点并收集错误信息
        3、收集v-for属性表达式的错误信息
        4、收集v-on指令表达式的错误信息
        5、收集其他指令表达式的错误信息
        6、三种错误信息，并会指出错误的位置
            1、'避免使用JavaScript一元运算符作为属性名'(只存在与v-on指令)
            2、'避免使用JavaScript关键字作为属性名'
            3、'无效表达式'
*/
function checkNode (node: ASTNode, errors: Array<string>) {
  // 当类型为节点时
  if (node.type === 1) {
    // 循环attrsMap对象
    for (const name in node.attrsMap) {
      /* 方便理解: const dirRE = /^v-|^@|^:/ */
      // 为绑定的属性时
      if (dirRE.test(name)) {
        // 获取属性值
        const value = node.attrsMap[name]
        // 值存在时
        if (value) {
          // v-for指令
          if (name === 'v-for') {
            // 收集v-for属性表达式的错误信息
            checkFor(node, `v-for="${value}"`, errors)
            // v-on指令或@
          } else if (onRE.test(name)) {
            checkEvent(value, `${name}="${value}"`, errors)
            // 其他指令
          } else {
            checkExpression(value, `${name}="${value}"`, errors)
          }
        }
      }
    }
    // 存在子节点时，循环对节点中的指令进行处理
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        checkNode(node.children[i], errors)
      }
    }
    // 类型为2的动态文本节点
  } else if (node.type === 2) {
    checkExpression(node.expression, node.text, errors)
  }
}
/*
  作用:
        1、v-on指令值表达式存在错误时，收集错误信息'避免使用JavaScript一元运算符作为属性名'或
            作用:'避免使用JavaScript关键字作为属性名'或'无效表达式',并指出错误位置
*/
function checkEvent (exp: string, text: string, errors: Array<string>) {
  // 便于理解: const stripStringRE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g
  // '(非'\字符或.字符)任意个' 或 "(非"\字符或.字符)任意个" 或 `(非`\字符或.字符)任意个${ 或 }(非`\字符或.字符)任意个` 或 `(非`\字符或.字符)任意个`
  // 去掉v-on指令的属性值的单引号(包括自身)或双引号(包括自身)或除``模板字符串中${}中的字符
  const stipped = exp.replace(stripStringRE, '')
  /*
      便于理解: const unaryOperatorsRE = new RegExp('\\b' + (
        'delete,typeof,void'
      ).split(',').join('\\s*\\([^\\)]*\\)|\\b') + '\\s*\\([^\\)]*\\)')
      "\b(delete)\s*\([^\)]*\)|\b(typeof)\s*\([^\)]*\)|\b(void)\s*\([^\)]*\)"
      空格delete 不可见字符任意个 左括号 非右括号字符任意个 右括号
      空格typeof 不可见字符任意个 左括号 非右括号字符任意个 右括号
      空格void 不可见字符任意个 左括号 非右括号字符任意个 右括号
  */
  // 缓存匹配到的字符 || undefined
  const keywordMatch: any = stipped.match(unaryOperatorsRE)
  // 存在匹配到的字符 && 匹配到的字符的前一个字符不是$则收集错误信息'避免使用JavaScript一元运算符作为属性名',并确定报错的位置
  if (keywordMatch && stipped.charAt(keywordMatch.index - 1) !== '$') {
    errors.push(
      `avoid using JavaScript unary operator as property name: ` +
      `"${keywordMatch[0]}" in expression ${text.trim()}`
    )
  }
  // 指令的表达式有误时,收集错误信息'避免使用JavaScript关键字作为属性名'或'无效表达式',并指出错误位置
  checkExpression(exp, text, errors)
}
/*
  作用:
        1、执行for属性值的表达式,如果有错误则收集错误信息(避免使用JavaScript关键字作为属性名 || 无效表达式)
        2、alias属性值的表达式作为变量名有错误时，收集错误信息'无效表达式'并指出错误位置(前提属性值为字符串类型时)
        2、iterator1属性值的表达式作为变量名有错误时，收集错误信息'无效表达式'并指出错误位置(前提属性值为字符串类型时)
        2、iterator2属性值的表达式作为变量名有错误时，收集错误信息'无效表达式'并指出错误位置(前提属性值为字符串类型时)
*/
function checkFor (node: ASTElement, text: string, errors: Array<string>) {
  checkExpression(node.for || '', text, errors)
  checkIdentifier(node.alias, 'v-for alias', text, errors)
  checkIdentifier(node.iterator1, 'v-for iterator', text, errors)
  checkIdentifier(node.iterator2, 'v-for iterator', text, errors)
}
/*
  作用:
       1、属性值表达式作为变量名有错误时，收集错误信息'无效表达式'并指出错误位置
*/
function checkIdentifier (
  ident: ?string,
  type: string,
  text: string,
  errors: Array<string>
) {
  // 当属性值为字符串类型
  if (typeof ident === 'string') {
    try {
      // 创建函数实例是否有错误
      new Function(`var ${ident}=_`)
    } catch (e) {
      // 收集错误信息'无效表达式'并指出错误位置
      errors.push(`invalid ${type} "${ident}" in expression: ${text.trim()}`)
    }
  }
}
/*
  作用:
        1、判断指令的表达式是否有误
        2、如果有误,使用了js关键字则收集信息'避免使用JavaScript关键字作为属性名',没有使用则收集错误'无效表达式'
*/
function checkExpression (exp: string, text: string, errors: Array<string>) {
  try {
    new Function(`return ${exp}`)
  } catch (e) {
    // 便于理解: const stripStringRE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g
    // '(非'\字符或.字符)任意个' 或 "(非"\字符或.字符)任意个" 或 `(非`\字符或.字符)任意个${ 或 }(非`\字符或.字符)任意个` 或 `(非`\字符或.字符)任意个`
    /* 便于理解: const prohibitedKeywordRE = new RegExp('\\b' + (
        'do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,' +
        'super,throw,while,yield,delete,export,import,return,switch,default,' +
        'extends,finally,continue,debugger,function,arguments'
       ).split(',').join('\\b|\\b') + '\\b')
       作用: 匹配空格do空格if空格for等等
    */
    //获取单引号或双引号之外的表达式和模板字符串``中${}中的表达式,匹配空格do或空格if
    const keywordMatch = exp.replace(stripStringRE, '').match(prohibitedKeywordRE)
    // 如果有匹配到的,则将错误信息'避免使用JavaScript关键字作为属性名'
    if (keywordMatch) {
      errors.push(
        `avoid using JavaScript keyword as property name: ` +
        `"${keywordMatch[0]}"\n  Raw expression: ${text.trim()}`
      )
    } else {
      // 没有匹配到的则收集信息'无效表达式'
      errors.push(
        `invalid expression: ${e.message} in\n\n` +
        `    ${exp}\n\n` +
        `  Raw expression: ${text.trim()}\n`
      )
    }
  }
}
