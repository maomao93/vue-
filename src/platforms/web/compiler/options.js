/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,
  directives,
  isPreTag,
  isUnaryTag,
  mustUseProp,
  canBeLeftOpenTag,
  isReservedTag,
  getTagNamespace,
  staticKeys: genStaticKeys(modules)
}
 let baseOptions = {
   expectHTML: true,
   modules: [
     {
       staticKeys: ['staticClass'],
       transformNode: function transformNode() {

       },
       genData: function (el) {
         let data = ''
         if (el.staticClass) {
           data += `staticClass:${el.staticClass},`
         }
         if (el.classBinding) {
           data += `class:${el.classBinding},`
         }
         return data
       }
     },
     {
       staticKeys: ['staticStyle'],
       transformNode: function transformNode() {

       },
       genData: function (el) {
         let data = ''
         if (el.staticStyle) {
           data += `staticStyle:${el.staticStyle},`
         }
         if (el.styleBinding) {
           data += `style:(${el.styleBinding}),`
         }
         return data
       }
     },
     {
       preTransformNode: function preTransformNode() {

       }
     }
   ],
   directives: {
     model: function (el: ASTElement, dir: ASTDirective, _warn: Function) {

     },
     text: function (el: ASTElement, dir: ASTDirective) {

     },
     html: function (el: ASTElement, dir: ASTDirective) {

     }
   },
   isPreTag: function (tag) {
     return tag === 'pre'
   },
   isUnaryTag: makeMap(
     'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
     'link,meta,param,source,track,wbr'
   ),
   mustUseProp: function (tag: string, type: ?string, attr: string) {
     const acceptValue = makeMap('input,textarea,option,select,progress')
     return (
       (attr === 'value' && acceptValue(tag)) && type !== 'button' ||
       (attr === 'selected' && tag === 'option') ||
       (attr === 'checked' && tag === 'input') ||
       (attr === 'muted' && tag === 'video')
     )
   },
   canBeLeftOpenTag: makeMap(
     'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
   ),
   isReservedTag: function (tag) {
     const isHTMLTag = makeMap(
       'html,body,base,head,link,meta,style,title,' +
       'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
       'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
       'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
       's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
       'embed,object,param,source,canvas,script,noscript,del,ins,' +
       'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
       'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
       'output,progress,select,textarea,' +
       'details,dialog,menu,menuitem,summary,' +
       'content,element,shadow,template,blockquote,iframe,tfoot'
     )
     const isSVG = makeMap(
       'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
       'foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
       'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
       true
     )
     return isHTMLTag(tag) || isSVG(tag)
   },
   getTagNamespace: function (tag) {
     const isSVG = makeMap(
       'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
       'foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
       'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
       true
     )
     if (isSVG(tag)) {
       return 'svg'
     }
     if (tag === 'math') {
       return 'math'
     }
   },
   staticKeys: 'staticClass,staticStyle'
 }
