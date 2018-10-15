/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  //初始化queue数组和activatedChildren数组，并将index下标初始化
  index = queue.length = activatedChildren.length = 0
  //清空watch队列
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  //避免重复执行nextTick()控制变量关闭，队列执行更新的标识符改为false
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  /*将watcher实例按id标识进行升序排列*/
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    //依次获取watcher实例
    watcher = queue[index]
    //存在watcher实例的before属性就执行before()
    if (watcher.before) {
      watcher.before()
    }
    //缓存watcher实例id标识
    id = watcher.id
    //将has数组中的标识清空,用来表示已经不在队列中,也就是初始化
    has[id] = null
    //执行实例的run方法(watch的回调、computed的get方法, 渲染函数的updateComponent()等等都会在run方法中执行)
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  //缓存watch列表
  const updatedQueue = queue.slice()

  //初始化一些控制变量
  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  //执行组件option中的updated函数
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  //循环队列中的watch实例
  while (i--) {
    //缓存当前watch实例
    const watcher = queue[i]
    //缓存当前watch的组件实例
    const vm = watcher.vm
    //watcher实例是渲染函数的实例并且挂载成功执行updated生命钩子
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
/*将一个观察者推入观察者队列。
 *具有重复id的作业将被跳过，除非它是
 *当队列被刷新时被推送。
*/
export function queueWatcher (watcher: Watcher) {
  //获取参数传入的观察者id标识符
  const id = watcher.id
  //判断该实例是否已经在队列中
  if (has[id] == null) {
    //将该观察者实例的标识符属性设置为true,表示该观察者实例已在队列中，避免重复放入队列中
    has[id] = true
    //只有当队列没有执行更新时才会简单地将观察者追加到队列的尾部，这个flushing变量就是队列执行更新的标识符
    if (!flushing) {
      queue.push(watcher)
    } else {
      //(触发计算属性的 get 拦截器函数时会有观察者入队的行为)
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      //获取队列的最后一个项的下标
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)
    }
  }
}
