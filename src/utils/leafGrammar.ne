@builtin "number.ne"
@builtin "whitespace.ne"
@preprocessor typescript

@{%
import {
   createBoldToken,
   createItalicsToken,
   createLinkToken,
   createStrikethroughToken,
   createTextToken,
   disambiguateTokens,
} from "samepage/utils/atJsonTokens";
import lexer, {
   createEmpty,
   createBlockTokens,
} from "./leafLexer";
%}

@lexer lexer

main -> ( tokens %newLine {% id %} | %newLine {% createEmpty %}):* tokens {% createBlockTokens %}

tokens -> token:+ {% disambiguateTokens %}

token -> %strike tokens %strike {% createStrikethroughToken %}
   | %boldUnder tokens %boldUnder {% createBoldToken %}
   | %boldStar tokens %boldStar  {% createBoldToken %}
   | %under tokens %under {% createItalicsToken %}
   | %star tokens %star {% createItalicsToken %}
   | %leftBracket tokens %rightBracket %leftParen %url %rightParen {% createLinkToken %}
   | %text {% createTextToken %}
   | %star  {% createTextToken %}
   | %carot  {% createTextToken %}
   | %tilde  {% createTextToken %}
   | %under  {% createTextToken %}
   | %leftParen {% createTextToken %}
   | %leftBracket {% createTextToken %}
   | %rightParen {% createTextToken %}
   | %rightBracket {% createTextToken %}