import os
import time
import argparse
from colorama import init, Fore, Back, Style

# colorama init
init()
# absolute path to current directory
script_directory = os.path.dirname(__file__)
# build array from output file
set_array = []
# set current branch
current_branch_name = 'develop'

# process_code_snippet takes in a search query, current code snippet
# and the original file text to increase the size of searched text
# until a matching query is found. It then returns the relevant code
# block for output to the terminal screen
def process_code_snippet(search_query, code_snippet, file_text):
    code_block_size = 256
    code_size_multiplier = 1
    code_size_multiplier_max = 3

    current_code_block = code_snippet
    query_location = file_text.find(search_query)
    semicolon_location = current_code_block.find(';')

    if ';' not in current_code_block:
        while semicolon_location < 0 and code_size_multiplier_max > 0:
            code_size_multiplier += 1
            new_code_block = file_text[query_location: query_location + (code_size_multiplier * code_block_size)]
            semicolon_location = new_code_block.find(';')
            code_size_multiplier_max -= 1

    return new_code_block


def format_spacing(string, buffer_spacing=0):
    number_of_spaces = (int(120 - len(string)) + buffer_spacing) * " "
    return number_of_spaces

# TODO add command for `git grep -in <pattern>` to generate file from repo

def main(search_query):
    current_time = time.time()
    program_name = "repo reaper"
    author_signature = "© chthonix 2023"
    format = program_name.rjust(len(program_name)+8)

    # program console output
    print(120 * '*')
    print('*' + 118 * ' ' + '*')
    print('*' + 118 * ' ' + '*')
    print('*' + '\t\t\t\t' + format + '\t\t\t\t\t' + '*')
    print('* \t\t\t\t\t'+ author_signature +'\t\t\t\t\t\t' +'*')
    print('*' + 118 * ' ' + '*')
    print('*' + 118 * ' ' + '*')
    print('*' + '\t' + 'This program returns relevant source code for searched queries.' + '\t' + '')
    print(120 * '*')
    print('*' + 118 * ' ' + '*')
    print('*' + 118 * ' ' + '*')
    print('*' + 118 * ' ' + '*')

    with open("grep-await-poc.txt") as source_file:
        for line in source_file:
            set_array.append(line)

    updated_set_array = set(set_array)
    line_count = len(updated_set_array)
    match_count = 0

    for idx, entry in enumerate(set_array):
        code_snippet = ''

        file_path = entry.split(':')[0]
        absolute_path = os.path.join(script_directory, file_path)
        exclude_patterns = ["yarn lockfile v1"] # TODO update with other patterns
        exclude_paths = ["yarn.lock", "en-us.yml"]
        match_tags = {
            "method_match": "METHOD MATCH",
            "translation_string": "TRANSLATION MATCH",
            "config_match": "TRANSLATION MATCH",
        }
        excluded_path_header = '\t' + Fore.RED + 'Excluded match in: ' + Style.RESET_ALL
        excluded_buffer = format_spacing(excluded_path_header, 1)
        formatted_excluded_path_header = excluded_path_header + excluded_buffer
        formatted_file_path_text = file_path + format_spacing(file_path, 2) + Style.RESET_ALL
        match_counter_header = '\t' + Back.LIGHTWHITE_EX + Fore.BLACK + Style.DIM + match_tags['method_match'] + Style.RESET_ALL  + ' ' + Fore.GREEN + str(match_count) + Style.RESET_ALL + " for: " + Back.BLUE + Style.BRIGHT + search_query + Style.RESET_ALL
        space_buffer = format_spacing(match_counter_header, -4)
        formatted_match_counter_header = match_counter_header + space_buffer
        formatted_method_match_header = match_counter_header + format_spacing(match_counter_header, 40)

        # TODO like .gitignore, allow user to ignore certain files
        if any(x in file_path for x in exclude_paths):
            print(120 * '*')
            print('*' + 118 * ' ' + '*')
            print('*' + 118 * ' ' + '*')
            print('*' + formatted_excluded_path_header) # + '*')
            print('*' + 10 * ' ' + formatted_file_path_text) # + '*')
            print('*' + 118 * ' ' + '*')
            print('*' + 118 * ' ' + '*')
            print(120 * '*')
            continue

        elif search_query in entry:
            match_count += 1
            code_snippet = entry

            print(120 * '*')
            print('*' + 118 * ' ' + '*')
            print('*' + 118 * ' ' + '*')
            print('*' + formatted_method_match_header) # + '*')
            print('*' + 118 * ' ' + '*')
            print("*" + 10 * ' ' + Fore.MAGENTA + formatted_file_path_text + Style.RESET_ALL) # + "*")

            # locate relevant query
            if ';' in code_snippet:
                query_index_location = code_snippet.find(search_query)
                semicolon_location = code_snippet.find(';') + 1
                code_match = code_snippet[query_index_location:semicolon_location]

                # print('*' + formatted_method_match_header + '*')
                print('*' + 118 * ' ' + '*')
                # TODO format by multiples of 80 and add 20 spaces of padding
                print('*' + '\t\t' + code_match) # +'*')
                print('*' + 118 * ' ' + '*')
                print('*' + 118 * ' ' + '*')

            else:
                print('*' + 118 * ' ' + '*')
                print('*' + '\t' + 'Sourcing code snippet...') # + '*')
                try:
                    with open(file_path) as file_origin:
                        f = file_origin.read()
                        if search_query in f:
                            query_index_location = f.find(search_query)

                            # skip imports
                            if 'import' in code_snippet:
                                print(Fore.LIGHTRED_EX + '\t' + 'IMPORT match: ' + Style.RESET_ALL + file_path)
                                print('*' + 118 * ' ' + '*')
                                print('*' + 118 * ' ' + '*')

                            # recursively find match
                            else:
                                code_slice = process_code_snippet(search_query, entry, f)
                                code_slice_length = len(code_slice)
                                # TODO fix formatting with above
                                print('*' + 118 * ' ' + '*')
                                print("*" + '\t\t' + code_slice) # + "*")
                                print('*' + 58 * ' ' + '...' + 57 * ' ' + '*')
                                print('*' + 118 * ' ' + '*')
                except IndexError:
                    print(f'No further code to analyze.')
                except FileNotFoundError:
                    # absolute path used for logging
                    print('*' + 118 * ' ' + '*')
                    print('*' + '\t' + Fore.RED + f'(404) File not Found:' + Style.RESET_ALL)
                    print('*' + '\t\t' + Fore.RED + absolute_path + Style.RESET_ALL)
                    print('*' + 118 * ' ' + '*')
                    print('*' + '\t'+ f'Currently on the {current_branch_name} branch. Switch branch? Y/n')
                    response = input('*' + '\t' + 'Please enter Y or n: ')
                    # handle user response
                    if len(response) > 0:
                        print('*' + '\t' + 'Responded ' + response + '\t\t\t\t\t' + '*')
                        print('*' + '\t' + 'One moment.... ' + '\t\t\t\t\t' + '*')
                    if response == 'n':
                        continue
                    if response == 'q':
                        break
                    print('*' + 118 * ' ' + '*')
                    # TODO run `git checkout <branchName>` to switch branch to locate code
                    continue
        else:
            print(120 * '*')
            print('*' + 118 * ' ' + '*')
            print('*' + 118 * ' ' + '*')
            print('*' + '\t\t\t\t' +  Fore.LIGHTBLACK_EX + 'Code fragment not found. Please try another search.' + Style.RESET_ALL) # + '*')
            print('*' + 118 * ' ' + '*')
            print('*' + 118 * ' ' + '*')
            print(120 * '*')

    analysis_complete_header = '\t\t\t' + Fore.GREEN + f'File analysis complete at {current_time} on {line_count} lines.' + Style.RESET_ALL
    analysis_spacing = format_spacing(analysis_complete_header, 2)
    formatted_analysis_complete_header = analysis_complete_header + analysis_spacing

    print(120 * '*')
    print('*' + 118 * ' ' + '*')
    print('*' + formatted_analysis_complete_header + '*')
    print('*' + 118 * ' ' + '*')
    print(120 * '*')
    return 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-s1', type=str, help='A search term for the repository.', default='')
    args = parser.parse_args()

# Testing different values
# main('await')
# main('await timeout(3000);')
# main('currentUser')
# main('file')
# main('institution')
# main('ajax')
# main('fetch')
main(args.s1)