# svelte-instant-view README

This extension is showing instant view for a svelte file.
It's not a compleate svelte transpile file. For quick viewing svelte browser image. 

## Features

This extension show the base html image embedded svelte file contains css file in the svelte file.
If the style tag in a svelte file is type of sass or scss, then it's complied to css file.
Attention! But it's not support included svelte compornents, And not support css file scope.

## Requirements
The extention open a local html file with Browser, So Site root-relative paths can't work. So use relative paths instead.

## Extension Settings

This extension contributes the following settings:

* `svelte-instant-view.baseFile`: set base html file. Default is 'public/index.html'.
* `svelte-instant-view.insertTagSelector`: set embeding tag selector. Default is 'body'.
* `svelte-instant-view.disableScript`: set svelte script in base html file. Default is 'build/bundle.js'.
* `svelte-instant-view.browser`: select Browser for viewing image. 'chrome', 'firefox' or 'edge) can select.

## Release Notes

Users appreciate release notes as you update your extension.

### 0.0.1

Initial release of ...
