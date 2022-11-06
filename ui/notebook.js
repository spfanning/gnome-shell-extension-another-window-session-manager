'use strict';

const PopupMenu = imports.ui.popupMenu;

const { Clutter, GObject, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();


var Notebook = class Notebook extends PopupMenu.PopupMenuSection {

    constructor() {
        super();
        // super._init({
        //     vertical: false,
        //     // style_class: 'notebook'
        // });

        // this.tabControls = new St.BoxLayout({ style_class: 'labels' });

        // this._selectedIndex = -1;
        // this._tabs = [];

        this._notebookBoxLayout = new St.BoxLayout({
            vertical: false,
            // style_class: 'notebook'
          });
        this.actor.add(this._notebookBoxLayout);

        this._tabs = new PopupMenu.PopupBaseMenuItem();
        this._notebookBoxLayout.add(this._tabs);

        this._tabPageMap = new Map();

    }

    appendPage(name, page) {
        const notebookButton = this._createNotebookButton(name);
        this._tabs.add_child(notebookButton);
        this._tabPageMap.set(notebookButton, page);

        notebookButton.connect('notify::hover', (widget) => {
            if (widget.get_hover()) {
                this._switchPage(widget);
                this._addPage(widget, page);
            }
        });

        this._addPage(notebookButton, page);
    }

    _addPage(widget, page) {
        if (!widget._pageAdded && page) {
            this.addMenuItem(page);
            widget._pageAdded = true;
        }
    }

    _switchPage(widget) {
        const tabs = this._tabs.get_children();
        for (const tab of tabs) {
            log(tab)
            if (tab !== widget) {
                tab.set_style('box-shadow: none');

                const otherPage = this._tabPageMap.get(tab);
                if (otherPage) {
                    otherPage.actor.hide();
                }
            }

        }
        
        // hover white #f6f5f4
        // https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow
        // https://developer.mozilla.org/en-US/docs/Web/CSS/border-radius
        widget.set_style('box-shadow: inset 0 -4px purple;');

        const currentPage = this._tabPageMap.get(widget);
        if (currentPage) {
            currentPage.actor.show();
        }
    }

    _createNotebookButton(label) {
        return new St.Button({
            label: label,
            style_class: 'notebook tabs',
            reactive: true,
            track_hover: true,
            can_focus: true,
        });
    }

}
