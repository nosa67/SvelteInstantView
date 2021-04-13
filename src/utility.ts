import { stringify } from 'node:querystring';
import * as sass from 'sass';

// 特定のタグ名のタグの開始終了位置の配列を取得
// [引数]   text        検索する対象の文字列
//          tagName     検索するタグ名
// [返値]   以下のオブジェクトの配列
//              tagStart　  タグの開始位置
//              tagEnd      タグの終了位置
export function getTagStartIndexs(text:string, tagName:string):{tagStart:number,tagEnd:number}[]{
    
    let findTagReg = RegExp("<[\x20\t]*?" + tagName + "([\x20\t]+.*?>|[\x20\t]*?>)", 'g');

    let result:{tagStart:number,tagEnd:number}[] = [];

    let findResult:RegExpExecArray | null;
    while((findResult = findTagReg.exec(text)) !== null){
        result.push({tagStart:findResult.index, tagEnd:findTagReg.lastIndex - 1 });
    }
    
    return result;
}

// 特定のタグでネストしていないタグの開始終了タグの範囲を取得する
// [引数]   text        検索する対象の文字列
//          tagName     検索するタグ名
// [返値]   以下のオブジェクトの配列
//              outerStart  タグの範囲の開始位置
//              outerEnd    タグの範囲の終了位置
//              innerStart  タグ内の文字列の開始位置
//              innerEnd    タグ内の文字列の終了位置
export function getTagBlocks(text:string, tagName:string):{outerStart:number,outerEnd:number,innerStart:number,innerEnd:number}[]{

    let startIndexs = getTagStartIndexs (text, tagName);
    let endIndexs = getTagStartIndexs (text, '/' + tagName);

    let tagBlocks:{outerStart:number,outerEnd:number,innerStart:number,innerEnd:number}[] = [];

    let indexForStart = 0;
    let indexForEnd = 0;

    // scriptタグの範囲を取得（scriptタグはネストしないものとしている）
    while(indexForStart < startIndexs.length)
    {
        // 開始位置を取得
        let start =  startIndexs[indexForStart].tagStart;

        // 終了位置が開始位置より前の場合は開始位置以降になるまで終了位置のインデックスを加算
        while((indexForEnd < endIndexs.length) && (endIndexs[indexForEnd].tagStart < start) )
        {
            indexForEnd ++;
        }

        if(indexForEnd < endIndexs.length)
        {
            // 終了位置が存在した場合、開始位置と終了位置のペアをタグ範囲のペアにする
            tagBlocks.push({outerStart:start,outerEnd:endIndexs[indexForEnd].tagEnd,
                innerStart:startIndexs[indexForStart].tagEnd + 1,innerEnd:endIndexs[indexForEnd].tagStart - 1});
        }else{
            // 終了位置が存在しなかった場合、エラー
            throw new Error('not exist endtag "</' + tagName + '>" started from ' + startIndexs[indexForStart].tagStart.toString() + '.');
        }

        indexForStart ++;
    }

    return tagBlocks;
}

// // タグ内の文字列から属性リストを取得する
// export function getTagAttrs(text:string):{[key:string]:string}{

//     let result:{[key:string]:string} = {};

//     text = text.trim();

//     let currentIndex = 0;
//     while(currentIndex < text.length){
//         let delimitInfo = multiIndexOf(text, currentIndex, ['=',' ','\t']);
//         if(delimitInfo.index >= 0){
//             let attrName = text.substr(currentIndex,delimitInfo.index).trim();
//             if(delimitInfo.findstr === '='){
//                 currentIndex = passSpaceAndTab(text, delimitInfo.index + 1);
//                 let attrValInfo = getAttrValue(text, currentIndex);

//             }else{
//                 currentIndex = passSpaceAndTab(text, delimitInfo.index + 1);
//                 if(text.substr(currentIndex,1) === '='){
//                     currentIndex = passSpaceAndTab(text, currentIndex + 1);
//                     delimitInfo = multiIndexOf(text, currentIndex, ['=',' ','\t']);

//                 }else{
//                     result[attrName] = '';
//                     currentIndex = currentIndex + 1;
//                 }
//             }
//         }else{
//             let attrName = text.substr(currentIndex).trim();
//             if(attrName.length > 0){
//                 result[attrName] = '';
//             }
//         }
//     }
    



//     return result;
// }

export function multiIndexOf(src:string,startIndex:number, findStrs:string[]):{index:number,findstr:string}{

    let index = src.length;
    let findStr = '';
    for(const searchItem of findStrs){
        let tmpIndex = src.indexOf(searchItem, startIndex);
        if((tmpIndex >=0 ) && (tmpIndex < index)) {
            index = tmpIndex;
            findStr = searchItem;
        }
    }
    if(index === src.length){
        return {index:-1,findstr:''};
    }else{
        return {index:index,findstr:findStr};
    }
}

export function getPlacefolderEnd(text:string, startIndex:number){

    let counter = 1;
    let index = startIndex;
    while((counter > 0) && (index < text.length)){
        index ++;
        let chr = text.substr(index,1);
        if(chr === '{'){
            counter ++;
        }else if(chr === '}'){
            counter --;
        }else if(chr === '"'){
            index = text.indexOf('"', index + 1);
        }else if(chr === "'"){
            index = text.indexOf("'", index + 1);
        }
    }
    if(index >= text.length){
        return -1;
    }else{
        return index;
    }
}

export function getTagStart(text:string, startIndex:number){

    let counter = 1;
    let index = startIndex;
    while((counter > 0) && (index < text.length)){
        index ++;
        let chr = text.substr(index,1);
        if(chr === '<'){
            counter --;
        }else if(chr === '{'){
            index = getPlacefolderEnd(text, index);
        }else if(chr === '"'){
            index = text.indexOf('"', index + 1);
        }else if(chr === "'"){
            index = text.indexOf("'", index + 1);
        }
    }
    return index;
}

export function getTagEnd(text:string, startIndex:number){
    let counter = 1;
    let index = startIndex;
    while((counter > 0) && (index < text.length)){
        index ++;
        let chr = text.substr(index,1);
        if(chr === '>'){
            counter --;
        }else if(chr === '{'){
            index = getPlacefolderEnd(text, index);
        }else if(chr === '"'){
            index = text.indexOf('"', index + 1);
        }else if(chr === "'"){
            index = text.indexOf("'", index + 1);
        }
    }
    return index;
}

export function passSpaceAndTab(text:string,startIndex:number):number{
    let char = text.substr(startIndex,1);
    while((char === ' ') || (char === '\t')){
        startIndex ++;
        if(startIndex >= text.length){
            return text.length;
        }
        char = text.substr(startIndex,1);
    }
    return startIndex;
}

export function getAttrValue(text:string, startIndex:number):{index:number,attrVal:string}{
    const startChar = text.substr(startIndex,1);
    if(startChar === '{'){
        let endIndex = getPlacefolderEnd(text, startIndex + 1);
        if(endIndex > startIndex){
            return {index:(endIndex + 1), attrVal:text.substr(startIndex,endIndex - startIndex + 1)};
        }else{
            return {index:text.length, attrVal:text.substr(startIndex,text.length - startIndex + 1)};
        }
        
    }else if(startChar === '"'){
        let endIndex = text.indexOf('"', startIndex + 1);
        let plaseFolderStart = text.indexOf('{', startIndex + 1);
        if((plaseFolderStart >= 0) && (plaseFolderStart < endIndex)){
            let chackStartIndex = getPlacefolderEnd(text, plaseFolderStart + 1);
            endIndex = text.indexOf('"', chackStartIndex + 1);
            plaseFolderStart = text.indexOf('{', chackStartIndex + 1);
        }
        if(endIndex > startIndex){
            return {index:(endIndex + 1), attrVal:text.substr(startIndex + 1,endIndex - startIndex - 1)};
        }
        else{
            return {index:text.length, attrVal:text.substr(startIndex + 1,text.length - startIndex - 1)};
        }
    }else if(startChar === "'"){
        let endIndex = text.indexOf("'", startIndex + 1);
        let plaseFolderStart = text.indexOf('{', startIndex + 1);
        if((plaseFolderStart >= 0) && (plaseFolderStart < endIndex)){
            let chackStartIndex = getPlacefolderEnd(text, plaseFolderStart + 1);
            endIndex = text.indexOf('"', chackStartIndex + 1);
            plaseFolderStart = text.indexOf('{', chackStartIndex + 1);
        }
        if(endIndex > startIndex){
            return {index:(endIndex + 1), attrVal:text.substr(startIndex + 1,endIndex - startIndex - 1)};
        }else{
            return {index:text.length, attrVal:text.substr(startIndex + 1,text.length - startIndex - 1)};
        }
    }else{
        let endIndexInfo = multiIndexOf(text, startIndex + 1,[' ', '\t']);
        if(endIndexInfo.index > startIndex){
            return {index:(endIndexInfo.index), attrVal:text.substr(startIndex,endIndexInfo.index - startIndex)};
        }
        else{
            return {index:text.length, attrVal:text.substr(startIndex,text.length - startIndex)};
        }
    }
}

export function getReflectVariablesText(text:string, variables:{[key:string]:string}){

    let evalScriptBase ="(function(){";
    for(let setAttr in variables){
        evalScriptBase += "let " + setAttr + "='" + variables[setAttr] + "'\n";
    }

    let current = 0;
    let resultText = "";
    let startIndex = text.indexOf('{');
    while(startIndex >= 0){
        let endIndex = getPlacefolderEnd(text, startIndex);
        if(endIndex >= 0){
            let name = text.substr(startIndex + 1,endIndex - startIndex - 1);
            const evalScript = evalScriptBase + "return " + name + "})()";
            let evalValue = "";
            try{
                evalValue = eval(evalScript);
            }catch{
            }
            resultText += text.substr(current, startIndex - current) + evalValue;
            current = endIndex + 1;
        }else{
            break;
        }
        startIndex = text.indexOf('{', current);
    }

    if(current < text.length){
        resultText += text.substr(current);
    }

    return resultText;
}

//--------------------------------------------------------------------------------
// スタイルシートの変換
//--------------------------------------------------------------------------------
export function convertSass(text:string, style:string): string{

    text = text.replace(/\r/g,'').replace(/\n/g,'').replace(/ /g,'');

    // styleタグの属性が「sass」や「scss」ならcssに変換して保存。それ以外ならそのまま保存
    if(style === "sass") {
        return sass.renderSync({data:text, indentedSyntax:true}).css.toString();
    }else if(style === "scss") {
        return sass.renderSync({data:text}).css.toString();
    }else{
        return text;
    }
}