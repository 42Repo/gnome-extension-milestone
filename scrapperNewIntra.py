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
options.add_argument(
    "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36"
)
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("--headless")
driver = webdriver.Chrome(
    service=Service(ChromeDriverManager().install()), options=options
)


def inverse_jour_mois(dates):
    dates_inversees = []
    for date in dates:
        jour, mois, annee = date.split("/")
        # Assurez-vous que le jour et le mois ont deux chiffres
        jour = jour.zfill(2)
        mois = mois.zfill(2)
        # Inversion du jour et du mois, tout en conservant l'année telle quelle
        date_inverse = f"{jour}/{mois}/{annee}"
        dates_inversees.append(date_inverse)
    return dates_inversees


def main(username, password):
    # Ouvrir la page de connexion
    try:
        # Ouvrir la page de connexion
        driver.get("https://signin.intra.42.fr/users/sign_in")
        # Attendre que le formulaire de connexion soit chargé
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "username"))
        )
        # Remplir le formulaire de connexion (ajustez les sélecteurs et les valeurs)
        driver.find_element(By.ID, "username").send_keys(username)
        driver.find_element(By.ID, "password").send_keys(password)
        driver.find_element(By.NAME, "login").click()

        # Attendre que la page se charge mais si la page se nomme "Attention Required! | Cloudflare" alors on quitte avec un messag d'erreur
        # time.sleep(120)
        try:
            WebDriverWait(driver, 5).until(EC.title_is("42 | Profile"))
        except TimeoutException:
            # si le titre est "Attention Required! | Cloudflare" alors on quitte avec un message d'erreur
            print(driver.title)
            if driver.title == "Attention Required! | Cloudflare":
                print("ERROR: Cloudflared. Wait a few minutes and try again.")
                sys.exit(1)
            else:
                print(
                    "ERROR: Échec de connexion ou titre de page inattendu. Vérifiez vos identifiants ou la disponibilité du site."
                )
                sys.exit(1)
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".font-bold.false"))
            )
        except TimeoutException:
            if driver.title == "Attention Required! | Cloudflare":
                print("ERROR: Cloudflared. Wait a few minutes and try again.")
                sys.exit(1)
            print(
                "ERROR: Échec de connexion ou titre de page inattendu. Vérifiez vos identifiants ou la disponibilité du site."
            )
            sys.exit(1)
        # Récupérer les dates .font-bold.false
        dates_milestone_elements = driver.find_elements(
            By.CSS_SELECTOR, ".font-bold.false"
        )
        dates_milestone_texts = [
            element.text
            for element in dates_milestone_elements
            if element.text.strip() != ""
        ]
        xpath = "//div[contains(@class, 'whitespace-nowrap') and contains(text(), 'Common Core ETA:')]/following-sibling::div[@class='font-bold']"
        date_eta_element = WebDriverWait(driver, 2).until(
            EC.visibility_of_element_located((By.XPATH, xpath))
        )
        date_eta_text = date_eta_element.text
        toutes_les_dates = dates_milestone_texts
        if date_eta_text:  # Si date_eta_text n'est pas vide
            toutes_les_dates.append(
                date_eta_text
            )  # Ajoutez date_eta_text comme nouvel élément de la liste
        dates_inverses = inverse_jour_mois(toutes_les_dates)
        # on screen la page pour vérifier que tout est ok avant de quitter et de fermer le navigateur

        print(dates_inverses[1])
        print(dates_inverses[0])
    finally:
        driver.quit()


if __name__ == "__main__":
    if len(sys.argv) == 3:
        main(sys.argv[1], sys.argv[2])
    else:
        print("ERROR: Veuillez fournir un nom d'utilisateur et un mot de passe.")
        sys.exit(1)
