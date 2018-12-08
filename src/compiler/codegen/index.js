/* @flow */

import { genHandlers } from './events'
import baseDirectives from '../directives/index'
import { camelize, no, extend } from 'shared/util'
import { baseWarn, pluckModuleFunction } from '../helpers'

type TransformFunction = (el: ASTElement, code: string) => string;
type DataGenFunction = (el: ASTElement) => string;
type DirectiveFunction = (el: ASTElement, dir: ASTDirective, warn: Function) => boolean;
/*
  作用:
        1、生成该实例公有的收集警告函数
        2、生成一个dataGenFns数组,包含所有的genData函数
        3、生成一个directives对象,包含用户自定义的指令函数和vue自带的指令函数
        4、生成一个判断标签不为html中的保留标签的函数maybeComponent
        5、生成一个应该是为v-once指令用的变量onceId
        6、生成一个缓存静态渲染函数用的数组staticRenderFns
*/
export class CodegenState {
  options: CompilerOptions;
  warn: Function;
  transforms: Array<TransformFunction>;
  dataGenFns: Array<DataGenFunction>;
  directives: { [key: string]: DirectiveFunction };
  maybeComponent: (el: ASTElement) => boolean;
  onceId: number;
  staticRenderFns: Array<string>;

  constructor (options: CompilerOptions) {
    //缓存options
    this.options = options
    // 缓存收集警告信息的函数
    this.warn = options.warn || baseWarn
    // 获取module数组中所有对象的transformCode属性值为数组(目前来说好像一个都没)
    this.transforms = pluckModuleFunction(options.modules, 'transformCode')
    // 获取module数组中所有对象的genData属性值为数组
    this.dataGenFns = pluckModuleFunction(options.modules, 'genData')
    // 将on、bind、cloak、model、text、html和用户自定的指令函数合成一个新的对象
    /*let directives = {
      on(){},
      bind(){},
      cloak(){},
      model(){},
      text(){},
      html(){}
    }*/
    this.directives = extend(extend({}, baseDirectives), options.directives)
    // 缓存options中判断标签为html中的保留标签的函数
    const isReservedTag = options.isReservedTag || no
    // 生成一个判断标签不为html中的保留标签的函数
    this.maybeComponent = (el: ASTElement) => !isReservedTag(el.tag)
    // 这个应该是为v-once指令用的
    this.onceId = 0
    // 缓存静态渲染函数用的
    this.staticRenderFns = []
  }
}

export type CodegenResult = {
  render: string,
  staticRenderFns: Array<string>
};
/*
    作用:
          1、将AST树中的解析成表达式
          2、将AST中的动态值变成字符串形式的动态渲染函数表达式
          3、将AST中的静态值变成字符串形式的静态渲染函数表达式(数组形式)
          4、将render(动态渲染函数表达式)和staticRenderFns(静态渲染函数表达式(数组形式))当成对象属性值输出
*/
export function generate (
  ast: ASTElement | void,
  options: CompilerOptions
): CodegenResult {
  // 生成一个CodegenState实例
  const state = new CodegenState(options)
  //将AST中的值解析成对应的表达式，最后将表达式字符串输出
  const code = ast ? genElement(ast, state) : '_c("div")'
  // 最后作为render函数表达式的值输出该AST树表达式
  return {
    render: `with(this){return ${code}}`,
    staticRenderFns: state.staticRenderFns
  }
}
/*
  作用: 将优化过的ast树中的所有值进行处理生成对应的表达式字符串，最后将该字符串输出
*/
export function genElement (el: ASTElement, state: CodegenState): string {
  // 标签为纯静态根标签 &&不存在staticProcessed属性或staticProcessed属性值为false
  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el, state)
    // once属性为true && 不存在onceProcessed属性或onceProcessed属性值为false
  } else if (el.once && !el.onceProcessed) {
    return genOnce(el, state)
    // 存在for属性 && 不存在forProcessed属性或forProcessed属性值为false
  } else if (el.for && !el.forProcessed) {
    return genFor(el, state)
    // 存在if属性 && 不存在ifProcessed属性或ifProcessed属性值为false
  } else if (el.if && !el.ifProcessed) {
    return genIf(el, state)
    // 标签名为template && 不存在slot属性
  } else if (el.tag === 'template' && !el.slotTarget) {
    return genChildren(el, state) || 'void 0'
    // 标签名为slot
  } else if (el.tag === 'slot') {
    return genSlot(el, state)
  } else {
    // component or element
    let code
    // 标签存在is属性
    if (el.component) {
      code = genComponent(el.component, el, state)
      // 不存在is属性
    } else {
      // 节点没有任何属性&&(不存在v-pre指令(前提:存在v-pre节点的子组件) || 不存在key属性)
      const data = el.plain ? undefined : genData(el, state)
      // 节点存在inlineTemplate属性
      const children = el.inlineTemplate ? null : genChildren(el, state, true)
      code = `_c('${el.tag}'${
        data ? `,${data}` : '' // data
      }${
        children ? `,${children}` : '' // children
      })`
    }
    // module transforms(在web端没有)
    for (let i = 0; i < state.transforms.length; i++) {
      code = state.transforms[i](el, code)
    }
    // 输出code
    return code
  }
}

// hoist static sub-trees out
/*
  作用:
        1、将staticProcessed属性设置为true。
        2、将`with(this){return ${genElement(el, state)}}`字符放入state.staticRenderFns数组中。
        3、返回`_m(${state.staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`字符串。
*/
function genStatic (el: ASTElement, state: CodegenState): string {
  // 设置节点的staticProcessed属性true,表示有处理过纯静态标签(因为纯静态的值处理一遍提高效率)
  el.staticProcessed = true
  state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`)
  return `_m(${
    state.staticRenderFns.length - 1
  }${
    el.staticInFor ? ',true' : ''
  })`
}

// v-once
/*
  作用:
        1、用于处理v-once属性,并设置onceProcessed = true;
        · 存在v-if属性,返回genIf(el, state)函数,结束该函数,也就是说处理v-if指令
        · staticInFor = true(根标签为false)
            1、存在key值,返回`_o(${genElement(el, state)},${state.onceId++},${key})`,结束该函数,
              genElement(el, state)等于继续处理下一种情况
            2、不存在key值,返回genElement(el, state),等于继续处理下一种情况
        · 不存在 v-if属性&&staticInFor = false,返回genStatic(el, state)函数,结束该函数。
*/
function genOnce (el: ASTElement, state: CodegenState): string {
  // 设置onceProcessed属性为true，避免重复处理
  el.onceProcessed = true
  // 存在v-if属性 && ifProcessed属性为false
  if (el.if && !el.ifProcessed) {
    // 将值作为genElement(el, state)函数的值,将其作为staticRenderFns数组中保存的第一个函数的返回值
    return genIf(el, state)
    // 不存在v-if属性或已经处理过v-if属性 && staticInFor属性为true(根标签staticInFor属性为false)
  } else if (el.staticInFor) {
    let key = ''
    // 缓存该标签的父标签信息
    let parent = el.parent
    // 直到找到存在v-for指令该标签或祖标签,将该存在v-for指令的该标签或祖标签的key属性值缓存为key变量
    while (parent) {
      if (parent.for) {
        key = parent.key
        break
      }
      parent = parent.parent
    }
    // 如果没有在v-for指令的标签上设置key属性则收集警告信息
    if (!key) {
      process.env.NODE_ENV !== 'production' && state.warn(
        `v-once can only be used inside v-for that is keyed. `
      )
      // 将值作为genElement(el, state)函数的值,将其作为staticRenderFns数组中保存的第一个函数的返回值
      return genElement(el, state)
    }
    // 将值作为genElement(el, state)函数的值,将其作为staticRenderFns数组中保存的第一个函数的返回值
    return `_o(${genElement(el, state)},${state.onceId++},${key})`
  } else {
    // 不存在v-if属性 || staticInFor属性为false
    // 将值作为genElement(el, state)函数的值,将其作为staticRenderFns数组中保存的第一个函数的返回值
    return genStatic(el, state)
  }
}
/*
  作用:
        1、设置ifProcessed属性为true。
        2、返回genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)函数。
*/
export function genIf (
  el: any,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  el.ifProcessed = true // avoid recursion
  return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}
/*
  作用:
        1、不存在v-if属性返回altEmpty参数 || '_e()'
        2、存在if属性值时,返回`(${condition.exp})?${genTernaryExp(condition.block)}
            :${genIfConditions(conditions, state, altGen, altEmpty)}`
        3、存在if属性值时,返回`${genTernaryExp(condition.block)}`
*/
function genIfConditions (
  conditions: ASTIfConditions,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  if (!conditions.length) {
    return altEmpty || '_e()'
  }
  // 获取存在if属性的节点信息
  const condition = conditions.shift()
  if (condition.exp) {
    return `(${condition.exp})?${
      genTernaryExp(condition.block)
    }:${
      genIfConditions(conditions, state, altGen, altEmpty)
    }`
  } else {
    return `${genTernaryExp(condition.block)}`
  }

  // v-if with v-once should generate code like (a)?_m(0):_m(1)
  function genTernaryExp (el) {
    return altGen ?
      altGen(el, state)
      :
      el.once ? genOnce(el, state) : genElement(el, state)
  }
}
/*
   作用:
        1、用来处理v-for指令的,将处理过的值变成表达式
*/
export function genFor (
  el: any,
  state: CodegenState,
  altGen?: Function,
  altHelper?: string
): string {
  // 缓存for循环的数据来源 比如:arr
  const exp = el.for
  // 缓存value
  const alias = el.alias
  // 存在index||key? `,(key || index)` : ''
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  // 存在index? `,index` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''
  // 非生产环境下 && 不是html保留标签名 && 标签名不是slot && 标签名不是template && 不存在key属性时收集警告信息
  if (process.env.NODE_ENV !== 'production' &&
    state.maybeComponent(el) &&
    el.tag !== 'slot' &&
    el.tag !== 'template' &&
    !el.key
  ) {
    state.warn(
      `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
      `v-for should have explicit keys. ` +
      `See https://vuejs.org/guide/list.html#key for more info.`,
      true /* tip */
    )
  }
  // 设置forProcessed属性为true表示已经用genFor处理过了
  el.forProcessed = true // avoid recursion
  return `${altHelper || '_l'}((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${(altGen || genElement)(el, state)}` +
    '})'
}
/*
  作用:   处理所有数据，将其转化成表达式
        1、处理directives的指令信息,并生成表达式字符串。存在model指令为el添加model属性信息对象;
          存在v-text、v-html时为el的prop对象中添加原生属性(已将值解析成表达式)
        2、解析key、ref、refInFor、pre、component、class和style
        3、解析attrs,对属性值中的行分隔符、段落分隔符进行转义
        4、解析props属性，将里面的原生属性值的行分隔符、段落分隔符进行转义,并放入domProps对象中
        5、将events中的事件信息处理并放入on属性中
        6、将nativeEvents中的事件信息处理并放入nativeOn属性中
        7、处理存在slot属性 && 不存在slot-scope属性的标签,设置slot属性为el.slotTarget
        8、处理子节点存在slot-scope属性的标签(存在scopedSlots),对所有插糟子元素进行处理,并作为scopedSlots属性值
        9、对el的model属性处理生成model属性。
        10、处理存在inlineTemplate属性的节点，第一个子元素类型为1时,将ast编译成渲染函数，否则报错。
            最后生成`inlineTemplate:{
              render:function(){${inlineRenderFns.render}},
              staticRenderFns:[${inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`).join(',')}]
            }`
        11、那些处理过的值都已转化成字符串，将这个字符串拼接生成字符串形式的key-value对象
*/
export function genData (el: ASTElement, state: CodegenState): string {
  let data = '{'

  // directives first.
  // directives may mutate the el's other properties before they are generated.
  const dirs = genDirectives(el, state)
  if (dirs) data += dirs + ','

  // key 存在key属性
  if (el.key) {
    data += `key:${el.key},`
  }
  // ref 存在ref属性
  if (el.ref) {
    data += `ref:${el.ref},`
  }
  // 节点在for循环中
  if (el.refInFor) {
    data += `refInFor:true,`
  }
  // pre 存在v-pre属性
  if (el.pre) {
    data += `pre:true,`
  }
  // record original tag name for components using "is" attribute 存在is属性
  if (el.component) {
    data += `tag:"${el.tag}",`
  }
  // module data generation functions 循环进行options中genData函数获取静态动态的class和style
  for (let i = 0; i < state.dataGenFns.length; i++) {
    data += state.dataGenFns[i](el)
  }
  // attributes 对剩余的属性值进行转义处理,并生成字符串形式的object对象
  if (el.attrs) {
    data += `attrs:{${genProps(el.attrs)}},`
  }
  // DOM props 对存在prop修饰符的属性的值和一些比较特殊的属性的值进行转义处理,并生成字符串形式的object对象
  if (el.props) {
    data += `domProps:{${genProps(el.props)}},`
  }
  // event handlers 对事件中的修饰符和属性值进行处理生成函数或数组，放入对应的key事件名中，然后将生成字符串形式的object对象输出
  if (el.events) {
    data += `${genHandlers(el.events, false, state.warn)},`
  }
  // 与上面一样处理的是nativeEvents
  if (el.nativeEvents) {
    data += `${genHandlers(el.nativeEvents, true, state.warn)},`
  }
  // slot target
  // only for non-scoped slots
  // 存在slot属性 && 不存在slot-scope属性 输出 比如: slot: 'header'
  if (el.slotTarget && !el.slotScope) {
    data += `slot:${el.slotTarget},`
  }
  // scoped slots 存在scopedSlots说明子节点存在slot-scope属性
  if (el.scopedSlots) {
    data += `${genScopedSlots(el.scopedSlots, state)},`
  }
  // component v-model 存在v-model指令
  if (el.model) {
    data += `model:{value:${
      el.model.value
    },callback:${
      el.model.callback
    },expression:${
      el.model.expression
    }},`
  }
  // inline-template // 存在inline-template属性
  if (el.inlineTemplate) {
    const inlineTemplate = genInlineTemplate(el, state)
    if (inlineTemplate) {
      data += `${inlineTemplate},`
    }
  }
  // 将最末尾的,去掉，并添加}字符
  data = data.replace(/,$/, '') + '}'
  // v-bind data wrap(可能在服务端)
  if (el.wrapData) {
    data = el.wrapData(data)
  }
  // v-on data wrap(可能在服务端)
  if (el.wrapListeners) {
    data = el.wrapListeners(data)
  }
  return data
}
/*
    作用:
          1、处理el的directives中的指令信息(不包括bind和on)
          2、通过内置或用户自定义的指令函数处理指令，并在el上添加相应的属性信息
          3、将处理好的directives属性输出
*/
function genDirectives (el: ASTElement, state: CodegenState): string | void {
  // 缓存节点的指令信息
  const dirs = el.directives
  // 不存在指令信息 直接return
  if (!dirs) return
  let res = 'directives:['
  let hasRuntime = false
  let i, l, dir, needRuntime
  // 循环指令信息
  for (i = 0, l = dirs.length; i < l; i++) {
    // 缓存单个指令信息
    dir = dirs[i]
    needRuntime = true
    // 对相应的指令进行相应的指令函数处理并返回相应的结果缓存
    const gen: DirectiveFunction = state.directives[dir.name]
    // 存在对应的指令处理函数
    if (gen) {
      // compile-time directive that manipulates AST.
      // returns true if it also needs a runtime counterpart.
      // 节点信息，指令信息，警告收集函数(除了存在is属性的component组件和用户自定义的组件返回false，其他都为true)
      needRuntime = !!gen(el, dir, state.warn)
    }
    /*
        1、不存在相对应的指令处理函数                                             needRuntime = true
        2、v-model指令处理的不是存在is属性的component组件 || 用户自定义的组件       needRuntime = true
        3、指令不为v-text、v-html、v-cloak(v-bind和v-on不在el的directives属性中)  needRuntime = true
    */
    if (needRuntime) {
      // 设置hasRuntime变量为true
      hasRuntime = true
      // 将指令信息拼成字符串放入res字符串中
      // '{name: "标签名称",rawName:"指令名称",存在属性值?(value:(指令属性值),expression:"字符串形式的指令值") : '',
      // 存在参数?(arg:"指令的参数") : "",存在修饰符?modifiers: 字符串化的指令对象'
      res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
        dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
      }${
        dir.arg ? `,arg:"${dir.arg}"` : ''
      }${
        dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
      }},`
    }
  }
  if (hasRuntime) {
    return res.slice(0, -1) + ']'
  }
}
/*
  作用:
        1、处理存在Inline-template属性的节点(子元素集合为0或大于1 || 第一个子元素的类型不为1)时，收集错误信息'内联模板组件必须只有一个子元素'
        2、第一个子元素类型为1时,将ast编译成渲染函数,返回
          `inlineTemplate:{
              render:function(){${inlineRenderFns.render}},
              staticRenderFns:[${inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`).join(',')}]
          }`
*/
function genInlineTemplate (el: ASTElement, state: CodegenState): ?string {
  // 缓存节点的以一个子元素信息
  const ast = el.children[0]
  // 在非生产环境下 && (子元素集合为0或大于1 || 第一个子元素的类型不为1)时，收集错误信息'内联模板组件必须只有一个子元素'
  if (process.env.NODE_ENV !== 'production' && (
    el.children.length !== 1 || ast.type !== 1
  )) {
    state.warn('Inline-template components must have exactly one child element.')
  }
  // 第一个子元素的类型为1时
  if (ast.type === 1) {
    const inlineRenderFns = generate(ast, state.options)
    return `inlineTemplate:{render:function(){${
      inlineRenderFns.render
    }},staticRenderFns:[${
      inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`).join(',')
    }]}`
  }
}
/*
  作用:
        1、对所有插糟子元素进行处理，输出比如:`scopedSlots:_u([genScopedSlot('header',ASTElement, state),genScopedSlot('default',ASTElement, state)])`
*/
function genScopedSlots (
  slots: { [key: string]: ASTElement },
  state: CodegenState
): string {
  /*
    scopedSlots: {
      header: ASTElement,
      "default": ASTElement
    }
  */
  return `scopedSlots:_u([${
    Object.keys(slots).map(key => {
      return genScopedSlot(key, slots[key], state)
    }).join(',')
  }])`
}
/*
   作用:
         1、对单个插糟子元素进行处理
         2、存在for属性,返回 _l((循环源数据),function(单个循环数据,下标||key,index || '') { return 第三步的输出值})
         3、不存在for属性,返回比如:
            {
              key: 'header',
              fn: `function(String(slotScope属性值)){
                  第一种(标签不为template): return genElement(el, state)
                  第二种(标签为template):
                      1、存在if属性: return `${el.if}?${genChildren(el, state) || 'undefined'}:undefined`
                      2、不存在if属性 return genChildren(el, state) || 'undefined'
              }`
            }
*/
function genScopedSlot (
  key: string,
  el: ASTElement,
  state: CodegenState
): string {
  //存在for属性 && forProcessed属性不存在
  if (el.for && !el.forProcessed) {
    return genForScopedSlot(key, el, state)
  }
  // 不存在for属性 || forProcessed为true
  const fn = `function(${String(el.slotScope)}){` +
    `return ${el.tag === 'template' // 标签为template
      ? el.if // 存在if属性的template
        ? `${el.if}?${genChildren(el, state) || 'undefined'}:undefined`
        : genChildren(el, state) || 'undefined'
      : genElement(el, state)
    }}`
  return `{key:${key},fn:${fn}}`
}
/*
  作用:
      对for循环进行处理,输出比如: _l((lists),function(item,index,'') { return genScopedSlot(key, el, state)})
*/
function genForScopedSlot (
  key: string,
  el: any,
  state: CodegenState
): string {
  const exp = el.for //缓存循环源数据字段
  const alias = el.alias // 缓存value字段
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : '' // 存在key || index字段
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''// 存在index字段
  // 设置forProcessed为true,表示已对v-for指令处理过了
  el.forProcessed = true // avoid recursion
  return `_l((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${genScopedSlot(key, el, state)}` +
    '})'
}
/*
   作用:
         1、不存在子节点，返回undefined
         2、只存在一个子节点 && 该节点不为template和slot,传了altGenElement参数返回altGenElement(el,state);
            没传返回genElement(el, state)
         3、不满足以上条件,传了altGenNode参数,对子元素结合进行altGenNode(c, state)处理,并将返回结果用，拼接放入
            数组中;没传对子元素结合进行genNode(c, state)处理.
            最后输出`[genNode(c, state),genNode(c, state)]` || `[genNode(c, state),genNode(c, state)], 2 || 3`
*/
export function genChildren (
  el: ASTElement,
  state: CodegenState,
  checkSkip?: boolean,
  altGenElement?: Function,
  altGenNode?: Function
): string | void {
  const children = el.children
  // 存在子元素
  if (children.length) {
    // 缓存第一个子元素的信息
    const el: any = children[0]
    // optimize single v-for 优化一个for循环
    //只有一个子元素&&存在for属性 && 不是template标签 && 不是slot标签时 返回genElement(el, state)
    if (children.length === 1 &&
      el.for &&
      el.tag !== 'template' &&
      el.tag !== 'slot'
    ) {
      return (altGenElement || genElement)(el, state)
    }
    const normalizationType = checkSkip
      ? getNormalizationType(children, state.maybeComponent)
      : 0
    const gen = altGenNode || genNode
    return `[${children.map(c => gen(c, state)).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''
    }`
  }
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
/*
  作用:
        1、子元素(存在for属性 || template || slot) || (存在if属性&&兄弟元素有一个(存在for属性 || 是template || 是slot)) 时 返回2,
        2、元素不为html保留字段的函数 || 存在if属性&&兄弟元素有一个标签不为html保留字段的函数 时, 返回1(前提不满足条件1)
        3、不满足以上条件是输出0
*/
function getNormalizationType (
  children: Array<ASTNode>, //子元素集合
  maybeComponent: (el: ASTElement) => boolean //判断该标签不为html保留字段的函数
): number {
  let res = 0
  // 循环子节点
  for (let i = 0; i < children.length; i++) {
    //缓存单个子节点信息
    const el: ASTNode = children[i]
    // 类型不为1的进入下一循环
    if (el.type !== 1) {
      continue
    }
    // (存在for属性 || template || slot) || (存在if属性&&兄弟元素有一个(存在for属性 || 是template || 是slot))时 设置res为2 终止循环
    if (needsNormalization(el) ||
        (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
      res = 2
      break
    }
    //该标签不为html保留字段的函数 || (存在if属性&&兄弟元素有一个标签不为html保留字段的函数)时 设置res为3 继续循环
    if (maybeComponent(el) ||
        (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
      res = 1
    }
  }
  //输出res
  return res
}
/*
  作用: 判断该标签 是否存在for属性 || 是否是template || 是否是slot
*/
function needsNormalization (el: ASTElement): boolean {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

/*
    作用:
          1、节点类型为1,返回genElement(node, state)
          2、节点类型为3&&为注释节点时,返回genComment(node)
          3、类型为2或类型为3的非注释节点时,返回genText(node)
*/
function genNode (node: ASTNode, state: CodegenState): string {
  if (node.type === 1) {
    return genElement(node, state)
  } if (node.type === 3 && node.isComment) {
    return genComment(node)
  } else {
    return genText(node)
  }
}
/*
  作用:
        1、处理纯文本节点或类型为2的动态文本节点.
        2、纯文本节点: 对纯文本节点中的行分隔符和段落分隔符转义,输出_v(文本)
        3、动态文本: 输出_v(表达式)
*/
export function genText (text: ASTText | ASTExpression): string {
  return `_v(${text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}

/*
  作用:
        1、处理注释文本内容,输出_e(注释文本)
*/
export function genComment (comment: ASTText): string {
  return `_e(${JSON.stringify(comment.text)})`
}

function genSlot (el: ASTElement, state: CodegenState): string {
  const slotName = el.slotName || '"default"'
  const children = genChildren(el, state)
  let res = `_t(${slotName}${children ? `,${children}` : ''}`
  const attrs = el.attrs && `{${el.attrs.map(a => `${camelize(a.name)}:${a.value}`).join(',')}}`
  const bind = el.attrsMap['v-bind']
  if ((attrs || bind) && !children) {
    res += `,null`
  }
  if (attrs) {
    res += `,${attrs}`
  }
  if (bind) {
    res += `${attrs ? '' : ',null'},${bind}`
  }
  return res + ')'
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
function genComponent (
  componentName: string,
  el: ASTElement,
  state: CodegenState
): string {
  const children = el.inlineTemplate ? null : genChildren(el, state, true)
  return `_c(${componentName},${genData(el, state)}${
    children ? `,${children}` : ''
  })`
}
/*
  作用: 对剩余未处理的属性值中的行分隔符和段落分隔符转义,并合并成以,隔开的key:value的格式字符串,将该字符串输出
*/
function genProps (props: Array<{ name: string, value: any }>): string {
  let res = ''
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    /* istanbul ignore if */
    if (__WEEX__) {
      res += `"${prop.name}":${generateValue(prop.value)},`
    } else {
      res += `"${prop.name}":${transformSpecialNewlines(prop.value)},`
    }
  }
  return res.slice(0, -1)
}

/* istanbul ignore next */
function generateValue (value) {
  if (typeof value === 'string') {
    return transformSpecialNewlines(value)
  }
  return JSON.stringify(value)
}

// #3895, #4268
/*这个编码为2028的字符为行分隔符、2029为段落分隔符，会被浏览器理解为换行，而在Javascript的字符串表达式中是不允许换行的，从而导致错误*/
function transformSpecialNewlines (text: string): string {
  return text
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
