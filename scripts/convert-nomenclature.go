package main

import (
    "fmt"
    "strings"
    "regexp"
    "os"
    "bufio"
)

type value string

func formatSnakeCase(translationFile string) string {

    re := regexp.MustCompile(`[\wa-zA-Z][+:]`)
    var matchFirstCap = regexp.MustCompile("(.)([A-Z][a-z]+)")
    var matchAllCap   = regexp.MustCompile("([a-z0-9])([A-Z])")

    var formatted_char = ""

    key_string := re.FindStringSubmatch(translationFile)
    if len(key_string) != 0 {
      snake := matchFirstCap.ReplaceAllString(translationFile, "${1}_${2}")
      snake  = matchAllCap.ReplaceAllString(snake, "${1}_${2}")
      snake = strings.ToLower(snake)
      fmt.Println("\nformatted \n", snake)
      formatted_char = snake
      return formatted_char
      } else {
        fmt.Println("\nnot formatted \n", translationFile)
        return translationFile
      }

}

func main() {
    file, err := os.Open("../resources/en-us-language-map.txt") // yml extension must first be converted to txt
																// copied and renamed text file is deleted after conversion
    if err != nil {
      fmt.Println(err)
    }

    scanner := bufio.NewScanner(file)
    scanner.Split(bufio.ScanWords)
    for scanner.Scan() {
      var scan_text = scanner.Text()
      formatSnakeCase(scan_text)
    }

    if err := scanner.Err(); err != nil {
      fmt.Println(err)
    }
    defer file.Close()
}
