# Installation du programme avec Selenium et l'extension GNOME

Ce guide vous montre comment installer le nécessaire pour exécuter un programme utilisant Selenium et installer une extension GNOME spécifique.

## Prérequis

- Avoir `git` installé sur votre système.
- Avoir `pip` installé sur votre système (généralement inclus avec Python).

## Étapes d'installation

### 1. Installation de Selenium

Selenium est un outil qui permet l'automatisation des navigateurs web. Pour l'installer, exécutez la commande suivante dans votre terminal :

```bash
pip install selenium
mkdir -p "$HOME/.local/share/gnome-shell/extensions/"
cd "$HOME/.local/share/gnome-shell/extensions/"
git clone https://github.com/42Repo/gnome-extension-milestone.git gnome-extension-milestone@asuc
killall -3 gnome-shell
gnome-extensions enable gnome-extension-milestone@asuc
```
Ce tutoriel couvre les bases de l'installation de Selenium et de l'installation et l'activation d'une extension GNOME. Modifiez les étapes selon vos besoins spécifiques ou les spécificités de votre environnement.
