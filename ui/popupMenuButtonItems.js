'use strict';

const { GObject, St, Clutter, Shell } = imports.gi;

const Main = imports.ui.main;

const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const SaveSession = Me.imports.saveSession;
const CloseSession = Me.imports.closeSession;
const RestoreSession = Me.imports.restoreSession;

const IconFinder = Me.imports.utils.iconFinder;
const FileUtils = Me.imports.utils.fileUtils;
const Log = Me.imports.utils.log;

const { Button } = Me.imports.ui.button;

var PopupMenuButtonItems = GObject.registerClass(
class PopupMenuButtonItems extends GObject.Object {

    _init() {
        super._init();
        this._log = new Log.Log();

        this._windowTracker = Shell.WindowTracker.get_default();

        this.buttonItems = [];
        this.addButtonItems();
    }

    addButtonItems() {
        const closeSession = new CloseSession.CloseSession();
        const popupMenuButtonItemCloseAll = new PopupMenuButtonItemClose(null, 
            'close-symbolic.svg', 
            'Close open windows', 
            'Closing open windows ...',
            (that) => {
                RestoreSession.restoringApps.clear();
                closeSession.closeWindows().catch(e => {
                    this._log.error(e)
                });
            });
        const popupMenuButtonItemCloseCurrent = new PopupMenuButtonItemClose(
            popupMenuButtonItemCloseAll,
            null, 
            'Close current application', 
            'Closing current application ...',
            (that) => {
                closeSession.closeWindows(that.currentApp).catch(e => {
                    this._log.error(e);
                });
            }, 
            (that) => {
                
                let workspaceManager = global.workspace_manager;
                const windows = workspaceManager.get_active_workspace().list_windows();
                if (windows && windows.length) {
                    windows.sort((w1, w2) => {
                        const userTime1 = w1.get_user_time;
                        const userTime2 = w2.get_user_time;
                        const diff = userTime1 - userTime2;
                        if (diff === 0) {
                            return 0;
                        }
                
                        if (diff > 0) {
                            return 1;
                        }
                
                        if (diff < 0) {
                            return -1;
                        }
                    });
                    const currentWindow = windows[0];
                    log(currentWindow.get_title())
                    const currentApp = this._windowTracker.get_window_app(currentWindow);
                    if (currentApp) {
                        that._currentApp = currentApp;
                        that.iconDescriptionLabel.set_text(`Close current application (${currentApp.get_name()})`);
                    }
                }
            });
        const popupMenuButtonItemSave = new PopupMenuButtonItemSave('save-symbolic.svg');
        
        this.buttonItems.push(popupMenuButtonItemCloseAll);
        this.buttonItems.push(popupMenuButtonItemCloseCurrent);
        this.buttonItems.push(popupMenuButtonItemSave);
    }

});


var PopupMenuButtonItem = GObject.registerClass(
class PopupMenuButtonItem extends PopupMenu.PopupMenuItem {

    _init() {
        super._init('');

        this.yesButton = null;
        this.noButton = null;
    }

    /**
     * Hide both Yes and No buttons by default
     */
    createYesAndNoButtons() {
        this.yesButton = this.createButton('emblem-ok-symbolic');
        this.noButton = this.createButton('edit-undo-symbolic');
        this.yesButton.add_style_class_name('confirm-before-operate');
        this.noButton.add_style_class_name('confirm-before-operate');
        this.hideYesAndNoButtons();
    }

    showYesAndNoButtons() {
        this.yesButton.show();
        this.noButton.show();
    }

    hideYesAndNoButtons() {
        this.yesButton.hide();
        this.noButton.hide();
    }

    createButton(iconSymbolic) {
        const button = new Button({
            icon_symbolic: iconSymbolic,
            button_style_class: 'button-item',
        }).button;
        return button;
    }

    createTimeLine() {
        // Set actor when using
        const timeline = new Clutter.Timeline({
            // 2s
            duration: 2000,
            repeat_count: 0,
        });
        return timeline;
    }

    // Add the icon description
    addIconDescription(iconDescription) {
        this.iconDescriptionLabel = new St.Label({
            text: iconDescription
        });
        this.actor.add_child(this.iconDescriptionLabel);
    }

});


var PopupMenuButtonItemClose = GObject.registerClass(
class PopupMenuButtonItemClose extends PopupMenuButtonItem {

    _init(group, iconSymbolic, label, closePrompt,callbackIfConfirm, update) {
        super._init();
        this.callbackIfConfirm = callbackIfConfirm;
        this.update = update;
        this.confirmLabel;
        
        this.closingLabel;

        this.closeButton;

        this._createButton(iconSymbolic);
        this.addIconDescription(label);
        if (group) {
            this.iconDescriptionLabel.connect('notify::allocation', () => {
                if (this.update) 
                    this.update(this);
                const margin = group.iconDescriptionLabel.get_x() - group.closeButton.get_x();
                this.iconDescriptionLabel.get_clutter_text().set_margin_left(margin);
            });
        }
        this._addConfirm();
        this._addYesAndNoButtons();
        this._addClosingPrompt(closePrompt);

        this._hideConfirm();

        this._timeline = this.createTimeLine();

        // Respond to menu item's 'activate' signal so user don't need to click the icon whose size is too small to find to click
        this.connect('activate', this._onActivate.bind(this));

    }

    _onActivate() {
        this._onClicked();
    }

    _hideConfirm() {
        this.confirmLabel.hide();
        this.hideYesAndNoButtons();
        this.closingLabel.hide();
    }

    _addYesAndNoButtons() {
        super.createYesAndNoButtons();
        
        this.yesButton.connect('clicked', () => {
            // TODO Do this when enable_close_by_rules is true? 
            this._parent.close();
            if (Main.overview.visible) {
                Main.overview.toggle();
            }

            this.callbackIfConfirm(this);
            this._hideConfirm();

            // Set the actor the timeline is associated with to make sure Clutter.Timeline works normally.
            // Set the actor in new Clutter.Timeline don't work
            this._timeline.set_actor(this.closingLabel);
            this._timeline.connect('new-frame', (_timeline, _frame) => {
                this.closingLabel.show();
            });
            this._timeline.start();
            this._timeline.connect('completed', () => {
                this._timeline.stop();
                this.closingLabel.hide();
            });

        });

        this.noButton.connect('clicked', () => {
            this._hideConfirm();
        });

        this.actor.add_child(this.yesButton);
        this.actor.add_child(this.noButton);

    }

    _addClosingPrompt(closePrompt) {
        this.closingLabel = new St.Label({
            style_class: 'confirm-before-operate',
            text: closePrompt,
            x_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.actor.add_child(this.closingLabel);
    }

    _createButton(iconSymbolic) {
        if (!iconSymbolic) return;
        this.closeButton = super.createButton(iconSymbolic);
        this.actor.add_child(this.closeButton);
        this.closeButton.connect('clicked', this._onClicked.bind(this));
    }

    _onClicked(button, event) {
        // In case someone hide close button again when this.closingLabel is still showing
        this._timeline.stop();
        this.closingLabel.hide();

        this.confirmLabel.show();
        this.showYesAndNoButtons();
    }

    _addConfirm() {
        this.confirmLabel = new St.Label({
            style_class: 'confirm-before-operate',
            text: 'Confirm?',
            x_expand: false,
            x_align: Clutter.ActorAlign.START,
        });
        this.actor.add_child(this.confirmLabel);
    }

    destroy() {
        // TODO Nullify others created objects?

        // TODO Also disconnect new-frame and completed?
        if (this._timeline) {
            this._timeline.stop();
            this._timeline = null;
        }

    }

});


var PopupMenuButtonItemSave = GObject.registerClass(
class PopupMenuButtonItemSave extends PopupMenuButtonItem {

    _init(iconSymbolic) {
        super._init();
        this.saveCurrentSessionEntry = null;
        this._createButton(iconSymbolic);
        this.addIconDescription('Save open windows');
        this._addEntry();
        // Hide this St.Entry, only shown when user click saveButton.
        this.saveCurrentSessionEntry.hide();
        this._addYesAndNoButtons();

        this._log = new Log.Log();
        this._saveSession = new SaveSession.SaveSession();

        this._timeline = this.createTimeLine();

        this.savingLabel = null;
        
        this._addSavingPrompt();

        // Respond to menu item's 'activate' signal so user don't need to click the icon whose size is too small to find to click
        this.connect('activate', this._onActivate.bind(this));

    }

    _addYesAndNoButtons() {
        super.createYesAndNoButtons();
        
        this.yesButton.connect('clicked', this._onClickedYes.bind(this));
        this.noButton.connect('clicked', () => {
            // clear entry
            this.saveCurrentSessionEntry.set_text('');
            this.saveCurrentSessionEntry.hide();
            super.hideYesAndNoButtons();
        });

        this.actor.add_child(this.yesButton);
        this.actor.add_child(this.noButton);

    }

    _onClickedYes(button, event) {
        this._gotoSaveSession();
    }

    _onActivate() {
        this._onClickedBeginSave();
    }

    _addSavingPrompt() {
        this.savingLabel = new St.Label({
            style_class: 'confirm-before-operate',
            x_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.actor.add_child(this.savingLabel);
    }

    _createButton(iconSymbolic) {
        const saveButton = super.createButton(iconSymbolic);
        this.actor.add_child(saveButton);
        saveButton.connect('clicked', this._onClickedBeginSave.bind(this));
    }

    _onClickedBeginSave(button, event) {
        this._timeline.stop();
        this.savingLabel.hide();

        this.saveCurrentSessionEntry.show();
        this.saveCurrentSessionEntry.grab_key_focus();
        super.showYesAndNoButtons();
    }

    _addEntry() {
        this.saveCurrentSessionEntry = new St.Entry({
            name: 'saveCurrentSession',
            hint_text: "Type a session name, default is defaultSession",
            track_hover: true,
            can_focus: true
        });
        const clutterText = this.saveCurrentSessionEntry.clutter_text;
        clutterText.connect('activate', this._onTextActivate.bind(this));
        this.actor.add_child(this.saveCurrentSessionEntry);

    }

    _onTextActivate(entry, event) {
        this._gotoSaveSession();
    }

    _gotoSaveSession() {
        let sessionName = this.saveCurrentSessionEntry.get_text();
        if (sessionName) {
            // '  ' is truthy
            if (!sessionName.trim()) {
                sessionName = FileUtils.default_sessionName;
            }
        } else {
            sessionName = FileUtils.default_sessionName;
        }

        const [canSave, reason] = this._canSave(sessionName);
        if (!canSave) {
            this._displayMessage(reason);
            return;
        }

        // clear entry
        this.saveCurrentSessionEntry.set_text('');
        
        this.saveCurrentSessionEntry.hide();
        super.hideYesAndNoButtons();

        this.savingLabel.set_text(`Saving open windows as '${sessionName}' ...`);
        this.savingLabel.show();

        this._saveSession.saveSessionAsync(sessionName).then(() => {
            this.savingLabel.hide();
        }).catch(e => {
            let message = `Failed to save session`;
            this._log.error(e, e.desc ?? message);
            global.notify_error(message, e.cause?.message ?? e.desc ?? message);
            this._displayMessage(e.cause?.message ?? e.message);
        });

    }

    _displayMessage(message) {
        // To prevent saving session many times by holding and not releasing Enter
        this.saveCurrentSessionEntry.hide();
        this.savingLabel.set_text(message);
        this._timeline.set_actor(this.savingLabel);
        const newFrameId = this._timeline.connect('new-frame', (_timeline, _frame) => {
            this._timeline.disconnect(newFrameId);
            this.savingLabel.show();
            this.hideYesAndNoButtons();
        });
        this._timeline.start();
        const completedId = this._timeline.connect('completed', () => {
            this._timeline.disconnect(completedId);
            this._timeline.stop();
            this.savingLabel.hide();
            this.saveCurrentSessionEntry.show();
            this.showYesAndNoButtons();
        });
    }

    _canSave(sessionName) {
        if (sessionName === FileUtils.sessions_backup_folder_name) {
            return [false, `ERROR: ${sessionName} is a reserved word, can't be used.`];
        }

        if (FileUtils.isDirectory(sessionName)) {
            return [false, `ERROR: Can't save windows using '${sessionName}', it's an existing directory!`];
        }

        if (sessionName.indexOf('/') != -1) {
            return [false, `ERROR: Session names cannot contain '/'`];
        }
        return [true, ''];
    }

    destroy() {
        // TODO Nullify others created objects?

        // TODO Also disconnect new-frame and completed?
        if (this._timeline) {
            this._timeline.stop();
            this._timeline = null;
        }

    }
    

});