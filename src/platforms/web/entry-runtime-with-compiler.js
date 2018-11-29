/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

//导入运行时的Vue
import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

//根据 id 获取元素的 innerHTML
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

//用变量缓存运行时的Vue原型的$mount方法
const mount = Vue.prototype.$mount
//重新改写运行时的Vue原型的$mount方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  /*不是生产环境下,如果挂载在html或body上报警告*/
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        /*template属性值的第一个字符是#号(也就是节点的id)*/
        if (template.charAt(0) === '#') {
          //获取节点中的el.innerHTML并缓存
          template = idToTemplate(template)
          /* istanbul ignore if */
          //警告提示获取不到存在该id的节点
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        /*这一种是template属性值是一个节点*/
        template = template.innerHTML
      } else {
        /*以上都不属于则提示错误*/
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      //template属性不存在，el属性存在
      //获取该节点
      template = getOuterHTML(el)
    }
    /*
      template属性值是个字符串但第一个字符不是#
        比如: template: '<App/>'
    */
    if (template) {
      /* istanbul ignore if */
      //开始编译做标记
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }
      // 将模板生成ast和渲染函数render和静态渲染函数集合staticRenderFns
      const { render, staticRenderFns } = compileToFunctions(template, {
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      // 缓存render函数和静态渲染函数集合
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        //对这两个标记点进行性能计算
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
//获取元素的outerHTML(包含innerHTML的全部内容外, 还包含对象标签本身)
/*IE9-11 中 SVG 标签元素是没有 innerHTML 和 outerHTML 这两个属性的*/
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

//为vue添加静态方法compile
Vue.compile = compileToFunctions

export default Vue
