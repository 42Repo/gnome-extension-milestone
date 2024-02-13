from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import NoSuchElementException, TimeoutException
import time
import sys

# Initialisation de WebDriver
options = webdriver.ChromeOptions()
options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("--headless")
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

def inverse_jour_mois(dates):
    # Création d'une liste pour stocker les dates inversées
    dates_inversees = []
    for date in dates:
        # Séparation de la date en ses composantes
        elements = date.split('/')
        # Inversion du jour et du mois
        date_inverse = f"{elements[1]}/{elements[0]}/{elements[2]}"
        # Ajout de la date inversée à la liste
        dates_inversees.append(date_inverse)
    return dates_inversees

def check_end_goals_filled(driver):
    try:
        # Trouver tous les éléments par la classe "end-goal"
        end_goals = driver.find_elements(By.CLASS_NAME, "end-goal")
        # Afficher les textes des deux premiers éléments pour débogage
        if len(end_goals) > 1:  # Assurez-vous qu'il y a au moins deux éléments
            # Vérifier si les deux premiers éléments sont non vides
            return end_goals[0].text.strip() != "" and end_goals[1].text.strip() != ""
        else:
            return False
    except Exception as e:
        print(f"ERROR: Erreur lors de la vérification des end-goals: {e}")
        return False

def main(username, password):
    # Ouvrir la page de connexion
    try:
        # Ouvrir la page de connexion
        driver.get("https://signin.intra.42.fr/users/sign_in")

        # on screen la page de connexion
        driver.save_screenshot("screenshot.png")
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "username")))
        # Remplir le formulaire de connexion (ajustez les sélecteurs et les valeurs)
        driver.find_element(By.ID, "username").send_keys(username)
        driver.find_element(By.ID, "password").send_keys(password)
        driver.find_element(By.NAME, "login").click()

        try:
            WebDriverWait(driver, 10).until(EC.title_is("Intra Profile Home"))
        except TimeoutException:
            print("ERROR: Échec de connexion ou titre de page inattendu. Vérifiez vos identifiants ou la disponibilité du site.")
            sys.exit(1)
        WebDriverWait(driver, 20).until(check_end_goals_filled)

        # Après attente, récupérer à nouveau les éléments pour s'assurer qu'ils sont correctement chargés
        try:
            end_goals = driver.find_elements(By.CLASS_NAME, "end-goal")

            if len(end_goals) >= 2:
                dates = inverse_jour_mois([end_goals[0].text, end_goals[1].text])
                print(dates[1])
                print(dates[0])
            else:
                print("ERROR: Moins de deux end-goals trouvés.")
        except NoSuchElementException:
            print("ERROR: Un ou plusieurs éléments attendus ne sont pas trouvés sur la page.")
            return False
    finally:
        driver.quit()

if __name__ == "__main__":
    if len(sys.argv) == 3:
        main(sys.argv[1], sys.argv[2])
    else:
        print("ERROR: Veuillez fournir un nom d'utilisateur et un mot de passe.")
        sys.exit(1)
