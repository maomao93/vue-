```ecmascript 6
/**
* 将ast树生成表达式字符串
* render: `with(this){return ${code}}`
* staticRenderFns: [`with(this){return ${code}}`,`with(this){return ${code}}`]
**/
const generate = (ast, options) => {
  const state = new CodegenState(options);
  //将AST中的值解析成对应的表达式，最后将表达式字符串输出
  const code = ast ? genElement(ast, state) : '_c("div")';
  return {
      render: `with(this){return ${code}}`,
      staticRenderFns: state.staticRenderFns//数组形式的表达式字符串.多个静态视图
  }
}
/**
* 输出compile函数和compileToFunctions函数
**/
const createCompiler = createCompilerCreator(
  function baseCompile (template, options) {
    const code = generate(ast, options);
    return {
      ast,
      render: code.render,//表达式字符串
      staticRenderFns: code.staticRenderFns//数组形式的表达式字符串
    }
  }
);
/**
* 输出createCompiler函数
**/
const createCompilerCreator = (baseCompile: Function) => {
  return function createCompiler (baseOptions) {
    function compile(template, options) {
       const finalOptions = Object.create(baseOptions)
       const compiled = baseCompile(template, finalOptions)
       return compiled
    }
    return {
       compile,
       compileToFunctions: createCompileToFunctionFn(compile)
    }
  } 
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
const { compile, compileToFunctions} = createCompiler(baseOptions);
//最终执行的
const { render, staticRenderFns} = compileToFunctions(template, {},this);
// 将表达式字符串变成函数
const createFunction = (code, errors) => {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}
/**
* 输出compileToFunctions函数
**/
const createCompileToFunctionFn = (compile: Function) => {
  return function compileToFunctions(template, options, vm) {
    const compiled = compile(template, options)
    const res = {};
    const fnGenErrors = [];
    res.render = createFunction(compiled.render, fnGenErrors);
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
        return createFunction(code, fnGenErrors)
    })
    return res
  }
}
```