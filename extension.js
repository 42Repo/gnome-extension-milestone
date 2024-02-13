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

            // Définition d'une fonction pour lancer le subprocess
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
                        // Traiter la sortie standard pour dire à l'utilisateur si les dates ont été mises à jour
                        Main.notify("Succès", "Les dates ont été mises à jour avec succès.");
                    } catch (e) {
                        Main.notify("Erreur", `Échec de l'exécution de scrapper.py avec ${pythonCommand}: ${e}`);
                    }
                });
            };

            // Vérifier si python3 est disponible
            let python3Subprocess = new Gio.Subprocess({
                argv: ['python3', '--version'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });

            python3Subprocess.init(null);
            python3Subprocess.communicate_utf8_async(null, null, (source, result) => {
                let [ok, stdout, stderr] = source.communicate_utf8_finish(result);
                if (ok) {
                    // Si python3 est disponible, l'utiliser
                    executeScript('python3');
                } else {
                    // Sinon, vérifier si python est disponible
                    let pythonSubprocess = new Gio.Subprocess({
                        argv: ['python', '--version'],
                        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
                    });
                    pythonSubprocess.init(null);
                    pythonSubprocess.communicate_utf8_async(null, null, (source, result) => {
                        let [ok, stdout, stderr] = source.communicate_utf8_finish(result);
                        if (ok) {
                            // Si python est disponible, l'utiliser
                            executeScript('python');
                        } else {
                            // Si ni python3 ni python n'est disponible, afficher un message d'erreur
                            Main.notify("Erreur", "Python n'est pas disponible sur ce système.");
                        }
                    });
                }
            });
        }
    });

        function init() {}

        function enable() {
            CounterInstance = new Counter();
            Main.panel.addToStatusArea('Counter', CounterInstance, 1, 'left');
        }

        function disable() {
            if (CounterInstance) {
                CounterInstance.destroy();
                CounterInstance = null;
            }
        }

