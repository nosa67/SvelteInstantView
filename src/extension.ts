// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {showSvelteView, showSvelteViewEditting} from './svelteInstantViwer';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// svelte インスタントビューのコマンドを登録
	let disposableFIle = vscode.commands.registerCommand('svelte-instant-view.show', (target) => {
		// The code you place here will be executed every time your command is executed

		// svelteのインスタントビューをブラウザで表示する
		try{
			showSvelteView(context, target);
		}
		catch(err){
			vscode.window.showErrorMessage(err.message);
		}
	});
	context.subscriptions.push(disposableFIle);

	// svelte インスタントビューのコマンドを登録
	let disposableEditting = vscode.commands.registerCommand('svelte-instant-view.showeditting', (target) => {
		// The code you place here will be executed every time your command is executed

		// svelteのインスタントビューをブラウザで表示する
		try{
			if(vscode.window.activeTextEditor !== undefined){
				showSvelteViewEditting(context, target, vscode.window.activeTextEditor.document.getText());
			}
		}
		catch(err){
			vscode.window.showErrorMessage(err.message);
		}
	});

	context.subscriptions.push(disposableEditting);
}

// this method is called when your extension is deactivated
export function deactivate() {}

