COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_BLUE='\033[0;34m'
COLOR_MAGENTA='\033[0;35m'
COLOR_CYAN='\033[0;36m'
COLOR_GRAY='\033[0;37m'
COLOR_RESET='\033[0m'

# Check if jq is installed, if not, install it
if ! command -v jq &> /dev/null; then
  echo -e "${COLOR_RED}jq could not be found. Installing...${COLOR_RESET}"
  sudo apt-get update
  sudo apt-get install -y jq
fi

echo -e "${COLOR_GREEN}Building images...${COLOR_RESET}"

# List all the apps in the apps folder
apps=$(ls apps)

TOTAL_IMAGES=$(ls apps | wc -l)
NUM_IMAGES=0
FAILED_IMAGES=()

for app in $apps; do
  echo -e "${COLOR_YELLOW}Building image for ${app}...${COLOR_RESET}"
  cd apps/$app
  # Get version from package.json
  version=$(jq -r '.version' package.json)
  result=$(docker build -t scanii/$app:$version-dev -f Dockerfile.dev .)
  if [ $? -eq 0 ]; then
    echo -e "${COLOR_GREEN}Image built successfully${COLOR_RESET}"
    NUM_IMAGES=$((NUM_IMAGES + 1))
    echo -e "${COLOR_YELLOW}Progress: ${NUM_IMAGES}/${TOTAL_IMAGES} images built${COLOR_RESET}"
  else
    echo -e "${COLOR_RED}Failed to build image${COLOR_RESET}"
    FAILED_IMAGES+=($app)
  fi
  cd ../..
done

if [ $NUM_IMAGES -eq $TOTAL_IMAGES ]; then
  echo -e "${COLOR_GREEN}All images built successfully${COLOR_RESET}"
else
  echo -e "${COLOR_RED}Failed to build some images${COLOR_RESET}"
  # List the images that failed to build
  for app in $apps; do
    if [ ! -f apps/$app/Dockerfile ]; then
      echo -e "${COLOR_RED}Dockerfile not found for ${app}${COLOR_RESET}"
      FAILED_IMAGES+=($app)
    fi
  done
fi