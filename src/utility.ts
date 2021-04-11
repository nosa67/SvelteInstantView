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
        if(endIndex > startIndex){
            return {index:(endIndex + 1), attrVal:text.substr(startIndex + 1,endIndex - startIndex - 1)};
        }
        else{
            return {index:text.length, attrVal:text.substr(startIndex + 1,text.length - startIndex - 1)};
        }
    }else if(startChar === '"'){
        let endIndex = text.indexOf('"', startIndex + 1);
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