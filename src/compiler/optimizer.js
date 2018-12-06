/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 * 优化器的目标:遍历生成的模板AST树和检测纯静态的子树，即部分
 * 永远不需要改变的领域。
 *
 * 一旦我们检测到这些子树，我们可以:
 *
 * 1。将它们提升到常量，这样我们就不再需要了
 *    在每次重新呈现时为它们创建新的节点;
 * 2。在修补过程中完全跳过它们。
 */
// 设置纯静态属性static为false || true, staticInFor为false || true(前提是类型为1 && (纯静态 || 存在v-once属性)) ,
// staticRoot属性为true || false(前提类型为1)
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  // 不存在AST数组直接return
  if (!root) return
  // 输出用来判断参数是否为type,tag,attrsList,attrsMap,plain,parent,children,attrs,staticClass,staticStyle的函数
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  // 缓存用来判断参数是否为保留标签的函数
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  // 判断是否为纯静态的
  markStatic(root)
  // second pass: mark static roots.
  markStaticRoots(root, false)
}

function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs' +
    (keys ? ',' + keys : '')
  )
}

/*
   作用:
        1、递归判断其子孙元素是否为纯静态的,并设置static属性为其判断的值
        2、节点为动态文本节点设置static: false
        3、节点为静态文本节点设置static: true
        4、标签存在v-pre属性 || (不存在指令属性、不存在v-if指令、不存在v-for指令、标签名不为slot或component、
          根标签或离其最近的祖元素是template、存在type,tag,attrsList,attrsMap,plain,parent,children,
          attrs,staticClass,staticStyle属性) 设置static: true否则static: false
        5、当节点类型为1时,也就是该节点为标签时,如果其子元素static属性为false则该元素的static属性为false。
*/
function markStatic (node: ASTNode) {
  //判断并添加static属性为当前节点是否为纯静态的
  node.static = isStatic(node)
  // 当该标签类型为1时
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      // 非html保留标签&&标签名不为slot&&不存在inline-template属性 直接结束此方法
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    // 循环当前标签的子元素,递归设置子元素的static属性是否为纯静态,只要标签内有一个子元素不为纯静态则该标签也不为纯静态的
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        node.static = false
      }
    }
    // 标签存在v-if指令,如果该标签的兄弟标签(包括兄弟标签的子元素)不为纯静态的则该标签也不为纯静态的
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}
/*
  作用:  前提(节点为非动态或静态文本节点)
        1、标签为纯静态或只渲染一次的设置staticInFor为false。
        2、· 标签为纯静态 && 存在长度大于1的子元素集合 && 第一个子元素类型为1的纯静态标签时,设置staticRoot为true
             并终止函数,表示静态根标签。
           · 不为纯静态||子元素集合长度等于0 || 子元素集合长度等于1 && 第一个子元素类型为纯静态文本节点时,设置staticRoot为false
        3、存在子元素集合时,循环其下面类型为1的子孙标签,子孙标签为纯静态或只渲染一次的设置staticInFor为(其父标签存在v-for或其存在
           v-for设置为true，否则false),然后执行2、3、4
        4、存在ifConditions属性,设置其类型为1的(兄弟元素及兄弟元素的子孙元素),执行1、2、3、4
*/
function markStaticRoots (node: ASTNode, isInFor: boolean) {
  // 非动态或静态文本节点
  if (node.type === 1) {
    // 该标签为纯静态的 || once属性为true时
    if (node.static || node.once) {
      // 设置ASTElement对象的staticInFor属性为false
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    if (node.static && node.children.length && !( // 纯静态属性&&存在子元素 && (子元素长度 > 1 || 第一个子元素类型为1的纯静态标签)
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      // 设置根标签的ASTElement对象的staticRoot属性为true并结束该函数,表示纯静态根标签
      node.staticRoot = true
      return
    } else {
      // 设置根标签的ASTElement对象的staticRoot属性为false,表示非纯静态根标签
      node.staticRoot = false
    }
    // 根标签为非纯静态根标签&&存在子元素
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

/*
  作用:
        1、动态文本节点返回false
        2、静态文本节点返回true
        3、存在v-pre属性 || (不存在指令属性、不存在v-if指令、不存在v-for指令、标签名不为slot或component、
          根标签或离其最近的祖元素是template、存在type,tag,attrsList,attrsMap,plain,parent,children,
          attrs,staticClass,staticStyle属性)
*/
function isStatic (node: ASTNode): boolean {
  // 动态文本返回false
  if (node.type === 2) { // expression
    return false
  }
  // 纯静态文本返回true
  if (node.type === 3) { // text
    return true
  }
  return !!(node.pre || ( // 存在v-pre属性
    !node.hasBindings && // no dynamic bindings 不存在指令属性
    !node.if && !node.for && // not v-if or v-for or v-else  不存在v-if指令&&不存在v-for指令
    !isBuiltInTag(node.tag) && // not a built-in 标签名不为slot或component
    isPlatformReservedTag(node.tag) && // not a component 是html保留标签
    !isDirectChildOfTemplateFor(node) && // 根标签或离其最近的祖元素不是template || 组元素不存在v-for
    Object.keys(node).every(isStaticKey)// 存在type,tag,attrsList,attrsMap,plain,parent,children,attrs,staticClass,staticStyle属性
    // 如果没有静态class和style, node中将不存在staticClass,staticStyle属性
  ))
}
/*
    作用:
          1、检测不为根元素,但是离其最近的祖元素是template返回false。
          2、检测不为根元素,但是离其最近的祖元素存在v-for指令返回true。
          3、检测为根元素 || 其祖元素即不是template也不存在v-for指令返回true
*/
function isDirectChildOfTemplateFor (node: ASTElement): boolean {
  // 存在该标签的父元素
  while (node.parent) {
    node = node.parent
    // 标签不是template返回false
    if (node.tag !== 'template') {
      return false
    }
    // 标签不是template && 存在v-for指令 返回 true
    if (node.for) {
      return true
    }
  }
  // 不存在父元素 || 祖先元素不是template || 祖先元素不存在v-for指令   返回false
  return false
}
