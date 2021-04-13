// import { stringify } from 'querystring';
import * as vscode from 'vscode';
import * as path from 'path';
import {JSDOM}  from 'jsdom';
import * as fs from 'fs';
import {SvelteDoc2} from './svelteDoc2';

const fileAddition:string = "_tmpview";

// ダミーのスタイルクラス名のヘッダ
const styleNameHeader = "dmy-class-";

let cssTempFile:string;
let svelteTempFile:string;

//====================================================================================================
//  svelteのインスタントビューを表示
//====================================================================================================
export function showSvelteView(context: vscode.ExtensionContext, targetFile:any){

    // 一時ファイルの作成
    const svelteTempFile = createTempSvelteFile(context, targetFile.fsPath);

    // 一時ファイルができなかったら処理しない
    if(svelteTempFile.length > 0 ){

        // 一時ファイルのブラウザ表示
        showBrowser("" + vscode.workspace.getConfiguration('svelte-instant-view').get('browser'), svelteTempFile);

        // 10秒後に一時ファイルを削除
        deleteSvelteTempFIle();
    }
}

export function showSvelteViewEditting(context: vscode.ExtensionContext, targetFile:any, edittingText:string){

    // 一時ファイルの作成
    const svelteTempFile = createTempSvelteFile(context, targetFile.fsPath, edittingText);

    // 一時ファイルができなかったら処理しない
    if(svelteTempFile.length > 0 ){

        // 一時ファイルのブラウザ表示
        showBrowser("" + vscode.workspace.getConfiguration('svelte-instant-view').get('browser'), svelteTempFile);

        // 10秒後に一時ファイルを削除
        deleteSvelteTempFIle();
    }
}

//----------------------------------------------------------------------------------------------------
// 表示用一時ファイルの作成
//----------------------------------------------------------------------------------------------------
function createTempSvelteFile(context: vscode.ExtensionContext, svelteFilePath:string, tetDoc?:string | undefined): string
{
    if(vscode.workspace.workspaceFolders !== undefined){

        // 設定されているベースファイルを取込んでDOMにする
        let baseFilePath =  path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "" + vscode.workspace.getConfiguration('svelte-instant-view').get('baseFile'));
        var baseHtml = fs.readFileSync(baseFilePath, 'utf8');
        const baseDOM = new JSDOM(baseHtml);

        // 対象のSvelteファイルを読み込む
        let svelteDoc2 = new SvelteDoc2();
        let sss = svelteDoc2.readFile(svelteFilePath);

        // スコープになるように変更したCSS情報を取得
        let cssAllText = svelteDoc2.getCss();

        // ベースファイルからsvelteのjavascriptを除去する(設定の「disableScript」に設定されている文字列をsrcに含むscriptタグ)
        exceptSvelteScript(baseDOM);

        // linkタグのsrcでルート相対パスがあれば相対パスに変更する
        changeRootRfPath(baseDOM);

        // svelteファイルのhtmlをベースファイルのドキュメントに埋め込み
        setSveltHtml(baseDOM, svelteDoc2.getHtml({}));

        // ベースファイルのパスの拡張子を除いたものを取得
        let tmpFileBasePath = baseFilePath.substr(0,baseFilePath.lastIndexOf("."));

        // css一時ファイルの作成
        cssTempFile = tmpFileBasePath + fileAddition + ".css";
        fs.writeFileSync(cssTempFile, cssAllText);

        // 保存したcssファイルを取り込むようにベースファイルのドキュメントに埋め込
        let cssFileOnlyName = cssTempFile.substring(cssTempFile.lastIndexOf('\\') + 1);
        let cssLinkElement = baseDOM.window.document.createElement("link");
        cssLinkElement.setAttribute("rel", "stylesheet");
        cssLinkElement.setAttribute("href", cssFileOnlyName);
        baseDOM.window.document.getElementsByTagName("HEAD")[0].appendChild(cssLinkElement);

        // const htmlData = removeSvelteCodes(baseDOM.window.document.body.innerHTML);
        baseDOM.window.document.body.innerHTML = removeSvelteCodes(baseDOM.window.document.body.innerHTML);

        // svelteの一時ファイルを出力
        svelteTempFile = tmpFileBasePath + fileAddition + ".html";
        // fs.writeFileSync(svelteTempFile, htmlData);
        fs.writeFileSync(svelteTempFile, baseDOM.serialize());

        return svelteTempFile;
    }else{
        throw new Error("NO workspase opens !");
    }
}

//--------------------------------------------------------------------------------
// 複数文字の検索で、位置と文字列を返す
//--------------------------------------------------------------------------------
function findMutiSting(sourceStr:string, startIndex:number,...values:string[]):[number,string]{
    
    // 複数文字列の検索用正規表現を作成
    let regStr = values[0];
    for(let i = 1; i < values.length; i ++){
        regStr += '|' + values[i];
    }
    let finder = new RegExp(regStr, 'g');

    // 正規表現の最終位置を開始位置の一つ前に設定
    finder.lastIndex = startIndex ;

    // 正規表現で検索
    let findResult = finder.exec(sourceStr);
    if(findResult === null){
        // 見つからなかった場合
        return [-1, ''];
    }else{
        // 見つけた位置と文字列を返す
        return [findResult.index, findResult[0]];
    }
}

//HTMLからsvelteの埋め込みを削除する
function removeSvelteCodes(source:string) : string{

    let startIndex = 0;

    let svelteCodeStart = source.indexOf('{');    
    
    let result = "";

    while(svelteCodeStart >= 0){
        result += source.substr(startIndex, svelteCodeStart - startIndex);
        let svelteCodeEnd =  getLastKakko(source, svelteCodeStart + 1);
        if(svelteCodeEnd >=source.length){
            break;
        }else{
            startIndex = svelteCodeEnd;
            svelteCodeStart = source.indexOf('{', startIndex);    
        }
    }
    if(startIndex < source.length){
        result += source.substr(startIndex);
    }
    result = result.replace(/&gt;/g,'> ');
    return result;
}

// 文字列の{が始まった位置から最終的な}の位置を取得する（最終的に閉じられていない場合は文字列の最終位置を取得する）
function getLastKakko(source:string, startIndex:number):number{
    
    let depth = 1;
    while(depth > 0){
        let nextDelimit = findMutiSting(source,startIndex, '{', '}' );
        if(nextDelimit[0] < 0){
            return source.length;
        }else{
            if(nextDelimit[1] === '{'){
                depth ++;
            }else{
                depth --;
            }
            startIndex = nextDelimit[0] + 1;
        }
    }
    return startIndex;
}

//--------------------------------------------------------------------------------
/// ベースファイルからsvelteのjavascriptを除去する(設定の「disableScript」に設定されている文字列をsrcに含むscriptタグ)
//--------------------------------------------------------------------------------
function exceptSvelteScript(baseDOM:JSDOM){

    let disableScript = "" + vscode.workspace.getConfiguration('svelte-instant-view').get('disableScript');
    let baseScriptElements = baseDOM.window.document.getElementsByTagName("script");
    for (let i = 0; i < baseScriptElements.length; i++) {
        let scriptElement = baseScriptElements[i];
        let srcAttr = scriptElement.getAttribute("src");
        if (srcAttr !== null) {
            if (srcAttr.toLowerCase().indexOf(disableScript) >= 0) {
                if (scriptElement.parentElement !== null) {
                    scriptElement.parentElement.removeChild(baseScriptElements[i]);
                }
                break;
            }
        }
    }
}

//--------------------------------------------------------------------------------
// linkタグのsrcでルート相対パスがあれば相対パスに変更する
//--------------------------------------------------------------------------------
function changeRootRfPath(baseDOM:JSDOM){
        
        let baseLinkElements = baseDOM.window.document.getElementsByTagName("link");
        for(let i= 0;i < baseLinkElements.length; i ++ ){
            let workAttr = baseLinkElements[i].getAttribute("href");
            if(workAttr !== null){
                if(workAttr[0] === "/"){
                    baseLinkElements[i].setAttribute("href", workAttr.substr(1));
                }
            }
            
        }

}

//--------------------------------------------------------------------------------
// svelteファイルのhtmlをベースファイルのドキュメントに埋め込み
//--------------------------------------------------------------------------------
function setSveltHtml(baseDOM:JSDOM, svelteHtml:string){

    let insertElementTagselector = vscode.workspace.getConfiguration('svelte-instant-view').get<string>('insertTagSelector');
    if(insertElementTagselector !== undefined){
        let insertElement = baseDOM.window.document.querySelector( insertElementTagselector);
        if(insertElement === null){
            throw new Error("Can't find TAG(selector = " + vscode.workspace.getConfiguration('svelte-instant-view').get('insertTagSelector') + ") in base html.");
        }
        insertElement.innerHTML = svelteHtml;
    }
}

//--------------------------------------------------------------------------------
// 一時ファイルのブラウザ表示
//--------------------------------------------------------------------------------
function showBrowser(browserName:string, svelteTempFilePath:string)
{
    if(browserName === "chrome"){
        doCommand('start chrome.exe "' + svelteTempFilePath + '"');
    }else if(browserName === "firefox"){
        doCommand('start firefox.exe "' + svelteTempFilePath + '"');
    }else if(browserName === "edge"){
        doCommand('start shell:Appsfolder\\Microsoft.MicrosoftEdge_8wekyb3d8bbwe!MicrosoftEdge "' + svelteTempFilePath + '"');
    }
}

//--------------------------------------------------------------------------------
// 30秒後に一時ファイルを削除
//--------------------------------------------------------------------------------
function deleteSvelteTempFIle()
{
    setTimeout(() => {
        // ファイル操作モジュールの追加
        var fs = require('fs');

        // svelte一時ビューファイルの削除
        fs.unlinkSync(svelteTempFile);

        // 一時cssファイルの削除
        if(cssTempFile.length > 0){
            fs.unlinkSync(cssTempFile);
        }
      }, 2500);
}

//====================================================================================================
// シェルコマンドを非同期実行する
//====================================================================================================
function doCommand(cmd:string) : Promise<string>
{
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        var jschardet = require('jschardet');
        var iconv = require('iconv-lite');

        // コマンドを実行
        exec(cmd, (err: any, stdout: any, stderr: any) => {
            if (err) {
                // エラーならエラーメッセージをutf-8でスロー
                var errorCharset = jschardet.detect(err);
                reject (iconv.decode(err, errorCharset.encoding));
            }
        
            // 標準出力の内容をutf-8にデコードして返す
            var resultChareset = jschardet.detect(stdout);
            resolve (iconv.decode(stdout, resultChareset.encoding));
        });
    });
}