# Installation du programme avec Selenium et l'extension GNOME

## Prérequis

- Avoir `git` installé sur votre système.
- Avoir `pip` installé sur votre système (généralement inclus avec Python).

## Étapes d'installation

```bash
pip install selenium
mkdir -p "$HOME/.local/share/gnome-shell/extensions/"
cd "$HOME/.local/share/gnome-shell/extensions/"
git clone https://github.com/42Repo/gnome-extension-milestone.git gnome-extension-milestone@asuc
killall -3 gnome-shell
gnome-extensions enable gnome-extension-milestone@asuc
pip install webdriver-manager
```
