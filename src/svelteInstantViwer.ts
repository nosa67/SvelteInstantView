import { stringify } from 'querystring';
import * as vscode from 'vscode';
import * as path from 'path';

export default function showSvelteView(context: vscode.ExtensionContext, targetFile:any){

    // 一時ファイルの作成
    let svelteTempFile = createTempSvelteFile(context, targetFile.fsPath);

    if(svelteTempFile.length > 0 ){
        // 一時ファイルのブラウザ表示
        showBrowser("" + vscode.workspace.getConfiguration('svelte-instant-view').get('browser'), svelteTempFile);

        // 30秒後に一時ファイルを削除
        deleteSvelteTempFIle(svelteTempFile);
    }
}

// 一時ファイルの作成
function createTempSvelteFile(context: vscode.ExtensionContext, svelteFilePath:string) : string
{
    if(vscode.workspace.workspaceFolders !== undefined){

        const {JSDOM} = require('jsdom');

        // ファイル操作モジュールの追加
        var fs = require('fs');

        // ベースファイルを取込
        let baseFilePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "" + vscode.workspace.getConfiguration('svelte-instant-view').get('baseFile'));
        var baseHtml = fs.readFileSync(baseFilePath, 'utf8');
        const baseDoc = new JSDOM(baseHtml);
    
        // 一時ファイルの名前を作成する
        let delimitPos = baseFilePath.lastIndexOf(".");
        let tmpFileName = baseFilePath.substr(0,delimitPos);
        let tmpHtmlFilePath = tmpFileName + "_tmp.html";
        let tmpCssFilePath = tmpFileName + "_tmp.css";

        // svelteファイルの取り込み
        let svelteHtml = fs.readFileSync(svelteFilePath, 'utf8');
        const svelteDoc = new JSDOM(svelteHtml).window.document;
        let styleElement:any = undefined;
        let htmElement:any = undefined;
        for(let el of svelteDoc.getElementsByTagName("body")[0].children){
            if(el.tagName === "STYLE"){
                styleElement = el;
            }else if(el.tagName !== "SCRIPT"){
                htmElement = el;
            }
        }

        // svelteファイルのスタイルシートの一時ファイルを作成しそのパスをベースファイルのドキュメントに埋め込み
        if(styleElement !== undefined)
        {
            let attrLang = styleElement.getAttribute("lang").toLowerCase();

            // styleタグの属性が「sass」や「scss」ならcssに変換して保存。それ以外ならそのまま保存
            if(attrLang === "sass"){
                let sass = require('sass'); // or require('node-sass');
                let tmpSassFilePath = tmpFileName + "_tmp.sass";
                fs.writeFileSync(tmpSassFilePath, styleElement.innerHTML);
                var result = sass.renderSync({file: tmpSassFilePath});
                fs.writeFileSync(tmpCssFilePath, result.css.toString());
                fs.unlinkSync(tmpSassFilePath);
            }else if(attrLang === "scss"){
                let sass = require('sass'); // or require('node-sass');
                let tmpScssFilePath = tmpFileName + "_tmp.scss";
                fs.writeFileSync(tmpScssFilePath, styleElement.innerHTML);
                
                var result = sass.renderSync({file: tmpScssFilePath});
                fs.writeFileSync(tmpCssFilePath, result.css.toString());
                fs.unlinkSync(tmpScssFilePath);
            }else{
                fs.writeFileSync(tmpCssFilePath, attrLang.innerHTML);
            }

            // 保存したcssファイルを取り込むようにベースファイルのドキュメントに埋め込
            let cssFileOnlyName = tmpCssFilePath.substring(tmpCssFilePath.lastIndexOf('\\') + 1);
            let cssLinkElement = baseDoc.window.document.createElement("link");
            cssLinkElement.setAttribute("rel", "stylesheet");
            cssLinkElement.setAttribute("href", cssFileOnlyName);
            baseDoc.window.document.getElementsByTagName("HEAD")[0].appendChild(cssLinkElement);
        }
        
        // svelteファイルのhtmlをベースファイルのドキュメントに埋め込み
        let insertElement = baseDoc.window.document.getElementById(vscode.workspace.getConfiguration('svelte-instant-view').get('insertTag'));
        if(insertElement === null){
            throw new Error("Can't find TAG(ID:" + vscode.workspace.getConfiguration('svelte-instant-view').get('insertTag') + ") in base html.");
        }
        insertElement.innerHTML = htmElement.innerHTML;

        // svelteの一時ファイルを出力
        fs.writeFileSync(tmpHtmlFilePath, baseDoc.serialize());
        return tmpHtmlFilePath;
    }else{
        throw new Error("NO workspase opens !");
    }
}

// 一時ファイルのブラウザ表示
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

// 30秒後に一時ファイルを削除
function deleteSvelteTempFIle(svelteTempFilePath:string)
{
    setTimeout(() => {
        // ファイル操作モジュールの追加
        var fs = require('fs');

        fs.unlinkSync(svelteTempFilePath);
      }, 30000);
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