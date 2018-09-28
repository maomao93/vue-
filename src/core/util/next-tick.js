/* @flow */
/* globals MessageChannel */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

const callbacks = []
let pending = false

//作用: 执行所有的回调函数并清空callbacks
function flushCallbacks () {
  //将状态改为false
  pending = false
  //获取所有需要执行的(包含回调函数的函数)
  const copies = callbacks.slice(0)
  //清空callbacks数组
  callbacks.length = 0
  //依次执行包含回调函数的函数
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).
let microTimerFunc
let macroTimerFunc
let useMacroTask = false
/*
  macro-task(宏任务)包括：script(整体代码), setTimeout, setInterval, setImmediate, I/O, UI rendering。
  micro-task(微任务)包括：process.nextTick, Promises, Object.observe, MutationObserver。
  执行顺序：函数调用栈清空只剩全局执行上下文，然后开始执行所有的micro-task。
          当所有可执行的micro-task执行完毕之后。循环再次执行macro-task中的一个任务队列，
          执行完之后再执行所有的micro-task，就这样一直循环。
*/

// Determine (macro) task defer implementation.
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
/* istanbul ignore if */
/*setImmediate: 表示等调用栈空闲下来时将回调推入调用栈(ui栈)*/
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else if (typeof MessageChannel !== 'undefined' && (
  isNative(MessageChannel) ||
  // PhantomJS
  MessageChannel.toString() === '[object MessageChannelConstructor]'
)) {
  const channel = new MessageChannel()
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)
  }
} else {
  /* istanbul ignore next */
  macroTimerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// Determine microtask defer implementation.
/* istanbul ignore next, $flow-disable-line */
//判断环境是否支持Promise
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  microTimerFunc = () => {
    //所有同步函数执行完后再直接这个flushCallbacks(也就是将flushCallbacks 函数注册为 microtask(微任务))
    p.then(flushCallbacks)
    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    /*怪异问题的变通方法，在一些 UIWebViews 中存在很奇怪的问题，即 microtask 没有被刷新，
    对于这个问题的解决方案就是让浏览做一些其他的事情比如注册一个 (macro)task 即使这个 (macro)task 什么都不做，
    这样就能够间接触发 microtask 的刷新*/
    if (isIOS) setTimeout(noop)
  }
} else {
  // fallback to macro
  microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 */
export function withMacroTask (fn: Function): Function {
  return fn._withTask || (fn._withTask = function () {
    useMacroTask = true
    const res = fn.apply(null, arguments)
    useMacroTask = false
    return res
  })
}

//全局API this.nextTick(),第一个参数是回调函数，第二个参数是改变回调的作用域(这个方法会强制使视图重新渲染)
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  //callbacks数组中添加函数(包含回调函数的函数)
  callbacks.push(() => {
    //是否存在回调函数
    if (cb) {
      try {
        //执行回调函数(因为回调函数时开发者自己定义的,所有有错误提示机制)
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      //将Promise状态改为success
      _resolve(ctx)
    }
  })
  //判断状态是否为false
  if (!pending) {
    pending = true
    if (useMacroTask) {
      macroTimerFunc()
    } else {
      //执行微任务，也就是确保同步任务执行完后执行所有callbacks中的函数
      microTimerFunc()
    }
  }
  // $flow-disable-line
  //不存在回调并且支持Promise返回一个Promise函数(使用Promise会使当所有callbacks中的函数执行完后才会执行then中的回调)
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
