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
    this.manualSelection = false;
    this.currentMilestoneIndex = 0;

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

                // Charger les dates depuis le fichier
                let { ETA, milestones } = this._loadDatesFromFile();

                // Créer et afficher l'ETA
                this.ETALabel = new St.Label({
                    text: "ETA : " + get_time((ETA.getTime() - (new Date()).getTime()) / 1000),
                    y_align: Clutter.ActorAlign.CENTER
                });
                box.add_child(this.ETALabel);

                // Créer le menu déroulant pour les milestones
                this.milestonesMenu = new PopupMenu.PopupSubMenuMenuItem("Select Milestone");
                this.menu.addMenuItem(this.milestonesMenu);

                // Remplir le menu déroulant avec les milestones
                milestones.forEach((milestone, index) => {
                    let menuItem = new PopupMenu.PopupMenuItem(`Milestone ${index + 1}: ${milestone.toLocaleDateString()}`);
                    menuItem.connect('activate', () => {
                        // Quand une milestone est sélectionnée, mettre à jour le label et définir manualSelection sur true
                        this.selectedMilestoneLabel.set_text(` | Milestone ${index + 1}: ` + get_time((milestone.getTime() - (new Date()).getTime()) / 1000));
                        this.currentMilestoneIndex = index;
                        this.manualSelection = true; // Empêcher la mise à jour automatique d'écraser cette sélection
                    });
                    this.milestonesMenu.menu.addMenuItem(menuItem);
                });
                // Ajouter le label pour la milestone sélectionnée
                this.selectedMilestoneLabel = new St.Label({
                    text: '',
                    y_align: Clutter.ActorAlign.CENTER
                });
                box.add_child(this.selectedMilestoneLabel);
                // Si des milestones sont disponibles, affiche la première par défaut
                if (milestones.length > 0) {
                    this._onMilestoneSelected(0);
                }
                this._addEntryFields();
                this._addRefreshButton();
                this._startRefreshLoop();
                this._refreshCountdowns();
            }

            _loadDatesFromFile() {
                let datesFilePath = GLib.build_filenamev([Me.dir.get_path(), 'dates.txt']);
                let milestones = [];
                let ETA;

                if (GLib.file_test(datesFilePath, GLib.FileTest.EXISTS)) {
                    let [res, contents] = GLib.file_get_contents(datesFilePath);
                    if (res) {
                        let lines = contents.toString().trim().split('\n');
                        if (lines.length > 0) {
                            // La première ligne est l'ETA
                            ETA = new Date(lines[0].trim());
                            ETA.setDate(ETA.getDate() + 1);

                            // Les lignes suivantes sont les milestones
                            for (let i = 1; i < lines.length; i++) {
                                let date = new Date(lines[i].trim());
                                date.setDate(date.getDate() + 1);
                                milestones.push(date);
                            }
                        }
                    }
                }
                if (!ETA) {
                    ETA = new Date("01/01/1970");
                }
                if (milestones.length === 0) {
                    milestones.push(new Date("01/01/1970"));
                }

                return { ETA, milestones };
            }


            _startRefreshLoop() {
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                    this._refreshCountdowns();
                    return GLib.SOURCE_CONTINUE; // Pour continuer à exécuter
                });
            }
            _refreshCountdowns() {
                let { ETA, milestones } = this._loadDatesFromFile();

                // Mettre à jour l'ETA en permanence
                this.ETALabel.set_text("ETA : " + get_time((ETA.getTime() - (new Date()).getTime()) / 1000));

                // Vérifier si une sélection manuelle a été faite
                if (this.manualSelection) {
                    // Mettre à jour le label de la milestone sélectionnée si l'utilisateur a fait une sélection manuelle
                    this.selectedMilestoneLabel.set_text(` | Milestone ${this.currentMilestoneIndex + 1}: ` + get_time((milestones[this.currentMilestoneIndex].getTime() - (new Date()).getTime()) / 1000));
                } else {
                    // Sinon, afficher la première milestone par défaut
                    if (milestones.length > 0) {
                        this.selectedMilestoneLabel.set_text(` | Milestone 1 : ` + get_time((milestones[0].getTime() - (new Date()).getTime()) / 1000));
                    }
                }
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
                this.menu.addMenuItem
                refreshButton.connect('activate', () => {
                    // Réinitialiser la sélection manuelle lors du rafraîchissement
                    this.manualSelection = false;
                    this.currentMilestoneIndex = 0; // Réinitialiser à la première milestone

                    // Recharger et rafraîchir les labels
                    this._loadDatesAndUpdateLabels();
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
                // Charger les données depuis le fichier
                let { ETA, milestones } = this._loadDatesFromFile();
                this.ETA = ETA;
                this.milestones = milestones;

                // Mise à jour des labels
                this._refreshCountdowns();
            }
            _onMilestoneSelected(index) {
                this.currentMilestoneIndex = index;
                this.manualSelection = true;
                this._refreshCountdowns();
            }

            _onMenuMilestoneSelected(menuItem, index) {
                menuItem.connect('activate', () => {
                    this._onMilestoneSelected(index);
                });
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

