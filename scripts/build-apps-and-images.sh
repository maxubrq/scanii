COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_BLUE='\033[0;34m'
COLOR_MAGENTA='\033[0;35m'
COLOR_CYAN='\033[0;36m'
COLOR_GRAY='\033[0;37m'
COLOR_RESET='\033[0m'

# Build app using turbo
echo -e "${COLOR_GREEN}Building apps...${COLOR_RESET}"
turbo build:ncc

# Build images
echo -e "${COLOR_GREEN}Building images...${COLOR_RESET}"
./scripts/build-images.sh