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

const EdCounter = GObject.registerClass(
    class EdCounter extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'ED Counter', false);

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

            Main.panel.addToStatusArea('ed_counter', this, 1, 'left');
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
                        return [new Date(dates[0].trim()), new Date(dates[1].trim())];
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

            // Lancer le script Python avec Gio.Subprocess
            let subprocess = new Gio.Subprocess({
                argv: ['python', scriptPath, username, password],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });
            subprocess.init(null);
            subprocess.communicate_utf8_async(null, null, (source, result) => {
                try {
                    let [ok, stdout, stderr] = source.communicate_utf8_finish(result);
                    if (!ok || stderr.length > 0 || stdout.includes("ERROR:")) {
                        let errorMsg = stderr || stdout; // Utilisez stderr ou stdout si stderr est vide
                        Main.notify("Erreur", `Erreur d'exécution de scrapper.py: ${errorMsg}`);
                        return;
                    }
                    // Traiter la sortie standard pour extraire les dates
                    let dates = stdout.trim().split('\n');
                    if (dates.length >= 2) {
                        // Convertir les chaînes de date en objets Date et les mettre à jour
                        this.firstCountdownDate = new Date(dates[0].trim());
                        this.secondCountdownDate = new Date(dates[1].trim());

                        // Sauvegarder les nouvelles dates dans le fichier
                        let datesContent = `${dates[0].trim()}\n${dates[1].trim()}`;
                        let datesFilePath = GLib.build_filenamev([Me.dir.get_path(), 'dates.txt']);
                        GLib.file_set_contents(datesFilePath, datesContent);

                        // Mettre à jour les labels immédiatement avec les nouvelles dates
                        Main.notify("Succès", "Les dates ont été mises à jour avec succès.");
                        this._refreshCountdowns();
                    } else {
                        Main.notify("Error", "Le script n'a pas retourné les dates attendues.");
                    }
                } catch (e) {
                    Main.notify("Erreur", `Échec de l'exécution de scrapper.py: ${e}`);
                }
            });
        }
    });

    function init() {}

    function enable() {
        new EdCounter();
    }

    function disable() {
        if (ed_counter) {
            ed_counter.destroy();
        }
    }
