/* @flow */

export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node

  // strictly internal
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?
  asyncFactory: Function | void; // async component factory function
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes
  fnOptions: ?ComponentOptions; // for SSR caching
  fnScopeId: ?string; // functional scope id support

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag //设置标签
    this.data = data //设置数据(事件信息、props信息等等)
    this.children = children //缓存子组件
    this.text = text //当前节点文本
    this.elm = elm //当前节点对应的真实DOM节点
    this.ns = undefined //当前节点命名空间
    this.context = context //当前节点上下文
    this.fnContext = undefined //函数化组件上下文
    this.fnOptions = undefined //函数化组件配置项
    this.fnScopeId = undefined //函数化组件ScopeId
    this.key = data && data.key //子节点key属性
    this.componentOptions = componentOptions //组件配置项
    this.componentInstance = undefined //组件实例
    this.parent = undefined //当前节点父节点
    this.raw = false //是否为原生HTML或只是普通文本
    this.isStatic = false //静态节点标志 keep-alive
    this.isRootInsert = true //是否作为根节点插入
    this.isComment = false //是否为注释节点
    this.isCloned = false //是否为克隆节点
    this.isOnce = false //是否为v-once节点
    this.asyncFactory = asyncFactory //异步工厂方法
    this.asyncMeta = undefined //异步Meta
    this.isAsyncPlaceholder = false //是否为异步占位
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance //读取函数返回当前组件实例
  }
}
/*
    作用: 创建一个空节点，或者说是没有内容的注释节点
*/
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}
/*
  作用: 创建一个文本节点
*/
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
/*
  作用:
        1、克隆节点
*/
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,//标签名
    vnode.data,//标签属性
    vnode.children,//子节点集合
    vnode.text,//节点文本
    vnode.elm,//当前虚拟节点对应的真实dom节点
    vnode.context,// 编译作用域
    vnode.componentOptions,// 创建组件实例时的options
    vnode.asyncFactory //异步工厂方法
  )
  cloned.ns = vnode.ns //节点的namespace( 名称空间)
  cloned.isStatic = vnode.isStatic //是否是静态节点
  cloned.key = vnode.key //节点标识，有利于patch优化
  cloned.isComment = vnode.isComment //是否为注释节点
  cloned.fnContext = vnode.fnContext //函数化组件的作用域，即全局上下文
  cloned.fnOptions = vnode.fnOptions //函数化组件配置项
  cloned.fnScopeId = vnode.fnScopeId //函数化组件ScopeId
  cloned.asyncMeta = vnode.asyncMeta //异步Meta
  cloned.isCloned = true //为克隆节点
  return cloned
}
