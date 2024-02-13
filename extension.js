    const Main = imports.ui.main;
    const {St, GLib} = imports.gi;
    const GObject = imports.gi.GObject;
    const Clutter = imports.gi.Clutter;
    const Gio = imports.gi.Gio;
    const PanelMenu = imports.ui.panelMenu;
    const PopupMenu = imports.ui.popupMenu;
    const Soup = imports.gi.Soup;
    const { MessageTray } = imports.ui.messageTray;
    const ExtensionUtils = imports.misc.extensionUtils;
    const Me = ExtensionUtils.getCurrentExtension();
    const _httpSession = new Soup.SessionAsync();

    let CounterInstance;

    function get_time(delta) {
        // calculate (and subtract) whole days
        var days = Math.floor(delta / 86400);
        delta -= days * 86400;

        // calculate (and subtract) whole hours
        var hours = Math.floor(delta / 3600) % 24;
        delta -= hours * 3600;

        // calculate (and subtract) whole minutes
        var minutes = Math.floor(delta / 60) % 60;
        delta -= minutes * 60;

        // what's left is seconds
        var seconds = Math.floor(delta % 60);  // in theory the modulus is not required
        if (seconds < 10)
            seconds = "0" + seconds;
        if (minutes < 10)
            minutes = "0" + minutes;
        if (hours < 10)
            hours = "0" + hours;
        return (days.toString() + " days " + hours + ":" + minutes + ":" + seconds);
    }

    const Counter = GObject.registerClass(
        class Counter extends PanelMenu.Button {
            _init() {
                super._init(0.0, 'Counter', false);
                let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
                this.add_actor(box);
                // Initialisation des dates à partir du fichier ou valeurs par défaut
                let [firstDate, secondDate] = this._loadDatesFromFile();

                this.firstCountdownDate = firstDate;
                this.secondCountdownDate = secondDate;
                // Configuration des labels
                this.firstCountdownLabel = new St.Label({
                    text: "Milestone : " + get_time((this.firstCountdownDate.getTime() - (new Date()).getTime()) / 1000),
                    y_align: Clutter.ActorAlign.CENTER
                });
                box.add_child(this.firstCountdownLabel);

                let spacer = new St.Label({ text: " | ", y_align: Clutter.ActorAlign.CENTER });
                box.add_child(spacer);

                this.secondCountdownLabel = new St.Label({
                    text: "FinTronCommun : " + get_time((this.secondCountdownDate.getTime() - (new Date()).getTime()) / 1000),
                    y_align: Clutter.ActorAlign.CENTER
                });
                box.add_child(this.secondCountdownLabel);
                // Ajouter les champs d'entrée pour Username et Password dans le menu
                this._addEntryFields();
                this._addRefreshButton();
                // Main.panel.addToStatusArea('Counter', this, 1, 'left');
                this._startRefreshLoop();
            }

            _loadDatesFromFile() {
                // Essayez de lire les dates à partir du fichier, sinon utilisez des valeurs par défaut
                let datesFilePath = GLib.build_filenamev([Me.dir.get_path(), 'dates.txt']);
                if (GLib.file_test(datesFilePath, GLib.FileTest.EXISTS)) {
                    let [res, contents] = GLib.file_get_contents(datesFilePath);
                    if (res) {
                        let dates = contents.toString().trim().split('\n');
                        if (dates.length >= 2) {
                            dates = [new Date(dates[0].trim()), new Date(dates[1].trim())];
                            dates[0].setDate(dates[0].getDate() + 1);
                            dates[1].setDate(dates[1].getDate() + 1);
                            return [dates[0], dates[1]];
                        }
                    }
                }
                // Valeurs par défaut si le fichier n'existe pas ou n'est pas valide
                return [new Date("01/01/1970"), new Date("01/01/1970")];
            }

            _startRefreshLoop() {
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                    this._refreshCountdowns();
                    return GLib.SOURCE_CONTINUE; // Pour continuer à exécuter
                });
            }

            _refreshCountdowns() {
                // Assurez-vous que cette méthode met à jour les labels basés sur les propriétés actuelles
                this.firstCountdownLabel.set_text("Milestone : " + get_time((this.firstCountdownDate.getTime() - (new Date()).getTime()) / 1000));
                this.secondCountdownLabel.set_text("FinTronCommun : " + get_time((this.secondCountdownDate.getTime() - (new Date()).getTime()) / 1000));
            }
            _addEntryFields() {
                // Champ d'entrée pour Username
                let usernameMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
                this.usernameEntry = new St.Entry({ hint_text: 'Enter username...', style_class: 'popup-menu-item' });
                usernameMenuItem.actor.add_child(this.usernameEntry);
                this.menu.addMenuItem(usernameMenuItem);

                // Champ d'entrée pour Password
                let passwordMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
                this.passwordEntry = new St.Entry({ hint_text: 'Enter password...', style_class: 'popup-menu-item' });
                this.passwordEntry.clutter_text.set_password_char('•');
                passwordMenuItem.actor.add_child(this.passwordEntry);
                this.menu.addMenuItem(passwordMenuItem);
            }

            _addRefreshButton() {
                let refreshButton = new PopupMenu.PopupMenuItem('Refresh');
                this.menu.addMenuItem(refreshButton);
                refreshButton.connect('activate', () => {
                    this._onRefreshClicked();
                });
            }


            _onRefreshClicked() {
                let username = this.usernameEntry.get_text();
                let password = this.passwordEntry.get_text();

                // Effacer les champs pour des raisons de sécurité
                this.usernameEntry.set_text('');
                this.passwordEntry.set_text('');

                // Construire le chemin absolu vers scrapper.py
                let scriptPath = Me.dir.get_path() + '/scrapper.py';

                const executeScript = (pythonCommand) => {
                    let subprocess = new Gio.Subprocess({
                        argv: [pythonCommand, scriptPath, username, password],
                        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
                    });
                    subprocess.init(null);
                    subprocess.communicate_utf8_async(null, null, (source, result) => {
                        try {
                            let [ok, stdout, stderr] = source.communicate_utf8_finish(result);
                            if (!ok || stderr.length > 0 || stdout.includes("ERROR:")) {
                                let errorMsg = stderr || stdout; // Utilisez stderr ou stdout si stderr est vide
                                Main.notify("Erreur", `Erreur d'exécution de scrapper.py avec ${pythonCommand}: ${errorMsg}`);
                                return;
                            }
                            // Traitement réussi, sauvegarder les dates dans un fichier
                            const datesFilePath = GLib.build_filenamev([Me.dir.get_path(), 'dates.txt']);
                            GLib.file_set_contents(datesFilePath, stdout); // stdout contient les dates séparées par des sauts de ligne

                            // Mise à jour des propriétés de l'extension avec les nouvelles dates
                            this._loadDatesAndUpdateLabels();

                            // Notifier l'utilisateur que les dates ont été mises à jour avec succès
                            Main.notify("Succès", "Les dates ont été sauvegardées avec succès dans dates.txt.");
                        } catch (e) {
                            Main.notify("Erreur", `Échec de l'exécution de scrapper.py avec ${pythonCommand}: ${e}`);
                        }
                    });
                };

                // Détermine quelle version de Python utiliser et exécute le script
                this._determinePythonAndExecute(executeScript);
            }

            _determinePythonAndExecute(executeScriptCallback) {
                // Vérifie la disponibilité de Python 3
                let python3Subprocess = new Gio.Subprocess({
                    argv: ['python3', '--version'],
                    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
                });

                python3Subprocess.init(null);
                python3Subprocess.communicate_utf8_async(null, null, (source, result) => {
                    let [ok, stdout, stderr] = source.communicate_utf8_finish(result);
                    if (ok) {
                        executeScriptCallback('python3');
                    } else {
                        // Vérifie la disponibilité de Python 2
                        let pythonSubprocess = new Gio.Subprocess({
                            argv: ['python', '--version'],
                            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
                        });
                        pythonSubprocess.init(null);
                        pythonSubprocess.communicate_utf8_async(null, null, (source, result) => {
                            let [ok, stdout, stderr] = source.communicate_utf8_finish(result);
                            if (ok) {
                                executeScriptCallback('python');
                            } else {
                                Main.notify("Erreur", "Python n'est pas disponible sur ce système.");
                            }
                        });
                    }
                });
            }

            _loadDatesAndUpdateLabels() {
                let [firstDate, secondDate] = this._loadDatesFromFile();
                this.firstCountdownDate = firstDate;
                this.secondCountdownDate = secondDate;

                // Met à jour les labels avec les nouvelles dates
                this._refreshCountdowns();
            }
        });

    function updateExtension() {
        const extensionUUID = "gnome-extension-milestone@asuc"; // UUID de l'extension
        const extensionDir = GLib.build_filenamev([GLib.get_home_dir(), ".local", "share", "gnome-shell", "extensions", extensionUUID]);

        // Vérifier si le répertoire de l'extension existe et est un dépôt Git
        if (GLib.file_test(extensionDir, GLib.FileTest.IS_DIR)) {
            const gitDir = GLib.build_filenamev([extensionDir, ".git"]);
            if (GLib.file_test(gitDir, GLib.FileTest.IS_DIR)) {
                // Le répertoire est un dépôt Git, procéder à la mise à jour
                const pullProcess = new Gio.Subprocess({
                    argv: ['git', '-C', extensionDir, 'pull'],
                    flags: Gio.SubprocessFlags.NONE,
                });

                pullProcess.init(null);
                pullProcess.wait_check_async(null, (source, result) => {
                    try {
                        if (source.wait_check_finish(result)) {
                            // La mise à jour a réussi
                            Main.notify("Mise à jour de l'extension", "L'extension a été mise à jour avec succès. Veuillez redémarrer GNOME Shell.");
                        } else {
                            // Échec de la mise à jour
                            Main.notify("Échec de la mise à jour", "Impossible de mettre à jour l'extension.");
                        }
                    } catch (e) {
                        global.log("Erreur", `Échec de la mise à jour de l'extension: ${e}`);
                    }
                });
            } else {
                Main.notify("Mise à jour impossible", "Le dossier de l'extension n'est pas un dépôt Git.");
            }
        } else {
            Main.notify("Mise à jour impossible", "Le dossier de l'extension n'existe pas.");
        }
    }

    function checkForUpdates() {
        const currentVersion = Me.metadata.version; // Version actuelle de l'extension
        const metadataUrl = "https://raw.githubusercontent.com/42Repo/gnome-extension-milestone/main/metadata.json";

        let message = Soup.Message.new('GET', metadataUrl);
        _httpSession.queue_message(message, (session, response) => {
            if (response.status_code === 200) {
                let metadata = JSON.parse(response.response_body.data);
                let remoteVersion = metadata.version;

                if (currentVersion !== remoteVersion) {
                    updateExtension();
                }
            } else {
                log("Erreur lors de la récupération du metadata.json: " + response.status_code);
            }
        });
    }

    function init() {}

    function enable() {
        checkForUpdates();
        CounterInstance = new Counter();
        Main.panel.addToStatusArea('Counter', CounterInstance, 1, 'left');
    }

    function disable() {
        if (CounterInstance) {
            CounterInstance.destroy();
            CounterInstance = null;
        }
    }

